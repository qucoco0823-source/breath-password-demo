/**
 * recorder-worklet.js — AudioWorkletProcessor：只负责"录"，不负责"判"
 *
 * ── 为什么 worklet 里不做检测 ──
 *
 * 一开始很容易想成"在 worklet 里实时跑状态机"。但那样会带来三个麻烦：
 *  1. 自适应底噪跟踪器的启动死锁：还没测出底噪就得先判断有没有声音。
 *  2. 因果滤波带来的边界偏移：实时处理拿不到"未来"数据，只能用因果平滑，
 *     而因果平滑会把起止边沿都往后推，推迟量还和斜率相关。
 *  3. 检测逻辑跑在 worklet 线程里，没法在 Node 里测试。
 *
 * 所以这里只做一件事：把原始 PCM 攒起来发回主线程。
 * 录完之后，主线程对整段数据做**两遍**离线分析（detect.js），
 * 于是可以用全局顺序统计量估底噪、用零相位平滑保住边界精度，
 * 而且整个检测过程变成一个纯函数，能在 Node 里完整测试。
 *
 * 另外每隔一小段发一个 RMS 给 UI 画电平表 —— 这个是给人看的，
 * 允许因果平滑，不影响检测精度。
 */

/**
 * 一次 postMessage 携带的样本数。
 * 48000 * 0.1 = 4800，即每 100ms 发一次，一次录 15 秒也只有 150 条消息。
 * 太小会让消息数量爆炸，太大会让 UI 电平表卡顿。
 */
const CHUNK_SAMPLES = 4800;

/** 电平表更新间隔（样本数）。480 @48k = 10ms，与分析帧的 hop 一致。 */
const METER_SAMPLES = 480;

class RecorderProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this._chunk = new Float32Array(CHUNK_SAMPLES);
    this._chunkPos = 0;
    // 累计样本数 —— 这是我们唯一的时钟。
    // 不用 performance.now()：主线程的时钟和音频硬件时钟会漂移，
    // 而样本数是精确的（时长 = 样本数 / sampleRate）。
    this._samplesSeen = 0;
    this._meterAcc = 0;
    this._meterCount = 0;
    this._stopped = false;

    this.port.onmessage = (e) => {
      if (e.data?.type === 'stop') {
        this._stopped = true;
        this._flush();
        this.port.postMessage({ type: 'stopped', samplesSeen: this._samplesSeen });
      }
    };
  }

  /** 把当前不满一整块的残余发出去。 */
  _flush() {
    if (this._chunkPos === 0) return;
    const out = this._chunk.slice(0, this._chunkPos);
    this.port.postMessage({ type: 'pcm', samples: out, samplesSeen: this._samplesSeen }, [out.buffer]);
    this._chunkPos = 0;
  }

  process(inputs) {
    if (this._stopped) {
      // 返回 false 会让节点被回收；这里返回 true 保持存活，
      // 由主线程负责 disconnect，避免"还没 flush 完就被回收"的竞态。
      return true;
    }

    const input = inputs[0];
    // 没有输入通道时（比如轨道刚结束）不要崩，静默跳过
    if (!input || input.length === 0) return true;
    const ch = input[0];
    if (!ch) return true;

    // 注意读 ch.length，不要写死 128。
    // 渲染量子大小 128 是**默认值而不是不变量**（renderSizeHint 已在实验中），
    // 写死会在未来某个 Chrome 版本上悄悄错位。
    const n = ch.length;

    for (let i = 0; i < n; i++) {
      const v = ch[i];

      this._chunk[this._chunkPos++] = v;
      if (this._chunkPos === CHUNK_SAMPLES) {
        // slice 出一份新的 buffer 并转移所有权，避免拷贝
        const out = this._chunk.slice(0);
        this.port.postMessage(
          { type: 'pcm', samples: out, samplesSeen: this._samplesSeen + i + 1 },
          [out.buffer]
        );
        this._chunkPos = 0;
      }

      // 电平表：累加均方
      this._meterAcc += v * v;
      this._meterCount++;
      if (this._meterCount >= METER_SAMPLES) {
        const meanSquare = this._meterAcc / this._meterCount;
        // 用 10*log10(均方) 而不是 20*log10(rms)：等价，但省一次 sqrt。
        // 加性 epsilon 保证静音附近仍然单调（-120dBFS，低于 16bit 量化底噪）。
        this.port.postMessage({
          type: 'level',
          levelDb: 10 * Math.log10(meanSquare + 1e-12),
          tMs: ((this._samplesSeen + i + 1) * 1000) / sampleRate,
        });
        this._meterAcc = 0;
        this._meterCount = 0;
      }
    }

    this._samplesSeen += n;
    return true;
  }
}

registerProcessor('breath-recorder', RecorderProcessor);
