// Sound Manager for handling UI sounds
class SoundManager {
  private audioContext: AudioContext | null = null
  private isEnabled: boolean = true
  private masterVolume: number = 1.0
  private soundEffectsVolume: number = 1.0

  constructor() {
    // Initialize audio context on first user interaction
    this.initializeAudioContext()
  }

  private initializeAudioContext() {
    try {
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()
    } catch (error) {
      console.warn('Web Audio API not supported:', error)
    }
  }

  private ensureAudioContext() {
    if (!this.audioContext) {
      this.initializeAudioContext()
    }
    
    if (this.audioContext && this.audioContext.state === 'suspended') {
      this.audioContext.resume()
    }
  }

  // Generate click sound using Web Audio API
  private generateMouseClickSound() {
    if (!this.isEnabled || !this.audioContext) return

    this.ensureAudioContext()
    
    try {
      // Create a more realistic mouse click sound using noise and filtering
      const bufferSize = this.audioContext.sampleRate * 0.05 // 50ms duration
      const buffer = this.audioContext.createBuffer(1, bufferSize, this.audioContext.sampleRate)
      const output = buffer.getChannelData(0)
      
      // Generate white noise with quick decay envelope
      for (let i = 0; i < bufferSize; i++) {
        const decay = Math.exp(-i / (bufferSize * 0.1)) // Quick exponential decay
        output[i] = (Math.random() * 2 - 1) * decay * 0.3
      }
      
      const source = this.audioContext.createBufferSource()
      source.buffer = buffer
      
      // Add high-pass filter to make it sound more like a click
      const filter = this.audioContext.createBiquadFilter()
      filter.type = 'highpass'
      filter.frequency.setValueAtTime(2000, this.audioContext.currentTime)
      filter.Q.setValueAtTime(1, this.audioContext.currentTime)
      
      const gainNode = this.audioContext.createGain()
      
      source.connect(filter)
      filter.connect(gainNode)
      gainNode.connect(this.audioContext.destination)
      
      const volume = this.masterVolume * this.soundEffectsVolume * 0.15
      gainNode.gain.setValueAtTime(volume, this.audioContext.currentTime)
      gainNode.gain.exponentialRampToValueAtTime(0.001, this.audioContext.currentTime + 0.05)
      
      source.start(this.audioContext.currentTime)
      source.stop(this.audioContext.currentTime + 0.05)
    } catch (error) {
      console.warn('Error playing click sound:', error)
    }
  }

  // Different click sounds for different UI elements
  playButtonClick() {
    this.generateMouseClickSound()
  }

  playTabClick() {
    this.generateMouseClickSound()
  }

  playToggleClick() {
    this.generateMouseClickSound()
  }

  playHoverSound() {
    // Keep a subtle hover sound different from click
    this.generateClickSound(400, 0.05)
  }

  playSuccessSound() {
    // Keep success sound as a tone for distinction
    this.generateClickSound(1200, 0.15)
  }

  playErrorSound() {
    // Keep error sound as a tone for distinction
    this.generateClickSound(300, 0.2)
  }

  // Keep the original tone generator for hover/success/error sounds
  private generateClickSound(frequency: number = 800, duration: number = 0.1) {
    if (!this.isEnabled || !this.audioContext) return

    this.ensureAudioContext()
    
    try {
      const oscillator = this.audioContext.createOscillator()
      const gainNode = this.audioContext.createGain()
      
      oscillator.connect(gainNode)
      gainNode.connect(this.audioContext.destination)
      
      oscillator.frequency.setValueAtTime(frequency, this.audioContext.currentTime)
      oscillator.type = 'sine'
      
      const volume = this.masterVolume * this.soundEffectsVolume * 0.1
      gainNode.gain.setValueAtTime(volume, this.audioContext.currentTime)
      gainNode.gain.exponentialRampToValueAtTime(0.001, this.audioContext.currentTime + duration)
      
      oscillator.start(this.audioContext.currentTime)
      oscillator.stop(this.audioContext.currentTime + duration)
    } catch (error) {
      console.warn('Error playing click sound:', error)
    }
  }

  // Settings management
  setEnabled(enabled: boolean) {
    this.isEnabled = enabled
  }

  setMasterVolume(volume: number) {
    this.masterVolume = Math.max(0, Math.min(1, volume / 100))
  }

  setSoundEffectsVolume(volume: number) {
    this.soundEffectsVolume = Math.max(0, Math.min(1, volume / 100))
  }

  getEnabled(): boolean {
    return this.isEnabled
  }
}

// Create singleton instance
export const soundManager = new SoundManager()

// Hook for React components
export const useSound = () => {
  return {
    playButtonClick: () => soundManager.playButtonClick(),
    playTabClick: () => soundManager.playTabClick(),
    playToggleClick: () => soundManager.playToggleClick(),
    playHoverSound: () => soundManager.playHoverSound(),
    playSuccessSound: () => soundManager.playSuccessSound(),
    playErrorSound: () => soundManager.playErrorSound(),
  }
}