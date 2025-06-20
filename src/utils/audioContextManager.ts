/**
 * AudioContext管理のシングルトンクラス
 * ブラウザの自動再生ポリシーに準拠したAudioContext管理を提供
 */
class AudioContextManager {
  private static instance: AudioContextManager | null = null
  private audioContext: AudioContext | null = null
  private isInitialized = false
  private pendingCallbacks: Array<(context: AudioContext) => void> = []

  private constructor() {
    // シングルトンパターンのためプライベートコンストラクタ
  }

  /**
   * AudioContextManagerのシングルトンインスタンスを取得
   */
  static getInstance(): AudioContextManager {
    if (!AudioContextManager.instance) {
      AudioContextManager.instance = new AudioContextManager()
    }
    return AudioContextManager.instance
  }

  /**
   * AudioContextを取得（初期化済みの場合）
   * 初期化されていない場合はnullを返す
   */
  getContext(): AudioContext | null {
    return this.audioContext
  }

  /**
   * AudioContextが初期化されているかチェック
   */
  isReady(): boolean {
    return this.isInitialized && this.audioContext !== null
  }

  /**
   * AudioContextを初期化（ユーザーインタラクション後に呼び出す）
   */
  async initialize(): Promise<AudioContext> {
    if (this.isInitialized && this.audioContext) {
      // 既に初期化済みの場合は、suspendedならresumeを試みる
      if (this.audioContext.state === 'suspended') {
        await this.audioContext.resume()
      }
      return this.audioContext
    }

    try {
      // AudioContextの作成
      const AudioContextClass =
        window.AudioContext || (window as any).webkitAudioContext
      this.audioContext = new AudioContextClass()

      // suspended状態の場合はresumeを試みる
      if (this.audioContext.state === 'suspended') {
        await this.audioContext.resume()
      }

      this.isInitialized = true
      console.log('AudioContext initialized successfully', {
        state: this.audioContext.state,
        sampleRate: this.audioContext.sampleRate,
      })

      // 保留中のコールバックを実行
      this.processPendingCallbacks()

      return this.audioContext
    } catch (error) {
      console.error('Failed to initialize AudioContext:', error)
      throw error
    }
  }

  /**
   * AudioContextを取得（初期化されていない場合は初期化を試みる）
   * ユーザーインタラクションが必要な場合はコールバックを登録
   */
  async getOrCreateContext(): Promise<AudioContext> {
    if (this.isReady() && this.audioContext) {
      return this.audioContext
    }

    // 初期化を試みる
    try {
      return await this.initialize()
    } catch (error) {
      console.warn(
        'AudioContext initialization failed, waiting for user interaction'
      )
      // ユーザーインタラクションを待つ
      this.setupUserInteractionListener()
      throw new Error('AudioContext requires user interaction')
    }
  }

  /**
   * AudioContextが利用可能になった時に実行するコールバックを登録
   */
  onReady(callback: (context: AudioContext) => void): void {
    if (this.isReady() && this.audioContext) {
      // 既に初期化済みの場合は即座に実行
      callback(this.audioContext)
    } else {
      // 保留中のコールバックに追加
      this.pendingCallbacks.push(callback)
      // ユーザーインタラクションリスナーをセットアップ
      this.setupUserInteractionListener()
    }
  }

  /**
   * ユーザーインタラクションを検出して自動初期化
   */
  private setupUserInteractionListener(): void {
    if (this.isInitialized) return

    const initOnInteraction = async () => {
      try {
        await this.initialize()
        // リスナーを削除
        document.removeEventListener('click', initOnInteraction)
        document.removeEventListener('touchstart', initOnInteraction)
        document.removeEventListener('keydown', initOnInteraction)
      } catch (error) {
        console.error(
          'Failed to initialize AudioContext on user interaction:',
          error
        )
      }
    }

    // ユーザーインタラクションイベントにリスナーを追加
    document.addEventListener('click', initOnInteraction, { once: true })
    document.addEventListener('touchstart', initOnInteraction, { once: true })
    document.addEventListener('keydown', initOnInteraction, { once: true })
  }

  /**
   * 保留中のコールバックを実行
   */
  private processPendingCallbacks(): void {
    if (!this.audioContext) return

    const callbacks = [...this.pendingCallbacks]
    this.pendingCallbacks = []

    callbacks.forEach((callback) => {
      try {
        callback(this.audioContext!)
      } catch (error) {
        console.error('Error executing pending AudioContext callback:', error)
      }
    })
  }

  /**
   * AudioContextをクリーンアップ
   */
  async cleanup(): Promise<void> {
    if (this.audioContext) {
      try {
        await this.audioContext.close()
      } catch (error) {
        console.error('Error closing AudioContext:', error)
      }
      this.audioContext = null
    }
    this.isInitialized = false
    this.pendingCallbacks = []
  }
}

// シングルトンインスタンスをエクスポート
export const audioContextManager = AudioContextManager.getInstance()
