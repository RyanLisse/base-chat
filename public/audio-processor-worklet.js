// Audio Worklet Processor for Real-time Audio Processing
// This replaces the deprecated ScriptProcessorNode with modern AudioWorkletNode

class AudioProcessor extends AudioWorkletProcessor {
  constructor() {
    super()
    this.bufferSize = 4096
    this.buffer = new Float32Array(this.bufferSize)
    this.bufferIndex = 0
  }

  process(inputs, outputs, parameters) {
    const input = inputs[0]
    
    if (input.length === 0) {
      return true
    }

    const inputChannel = input[0]
    
    // Process audio in chunks
    for (let i = 0; i < inputChannel.length; i++) {
      this.buffer[this.bufferIndex] = inputChannel[i]
      this.bufferIndex++

      // When buffer is full, send it to main thread
      if (this.bufferIndex >= this.bufferSize) {
        // Convert float32 to int16
        const int16Array = new Int16Array(this.bufferSize)
        for (let j = 0; j < this.bufferSize; j++) {
          int16Array[j] = Math.max(-32768, Math.min(32767, this.buffer[j] * 32768))
        }

        // Send processed audio data to main thread
        this.port.postMessage({
          type: 'audioData',
          data: int16Array
        })

        // Reset buffer
        this.bufferIndex = 0
      }
    }

    return true
  }
}

registerProcessor('audio-processor', AudioProcessor)