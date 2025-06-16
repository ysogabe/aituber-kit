import { SpeechPayload, MqttMessageHandleResult } from '../types'
import { Talk, EmotionType } from '@/features/messages/messages'
import { speakCharacter } from '@/features/messages/speakCharacter'
import settingsStore from '@/features/stores/settings'
import homeStore from '@/features/stores/home'
import { Live2DHandler } from '@/features/messages/live2dHandler'
import { generateMessageId } from '@/utils/messageUtils'

/**
 * MQTT経由で受信した発話指示を処理するハンドラー
 */
export class SpeechHandler {
  private live2dHandler?: Live2DHandler

  constructor() {
    // Live2Dハンドラーの初期化
    this.initializeLive2DHandler()
  }

  /**
   * Live2Dハンドラーを初期化
   */
  private initializeLive2DHandler(): void {
    try {
      this.live2dHandler = new Live2DHandler()
    } catch (error) {
      console.warn('Live2D handler initialization failed:', error)
    }
  }

  /**
   * 発話ペイロードを処理してAITuberに発話させる
   */
  async handleSpeechPayload(
    payload: SpeechPayload
  ): Promise<MqttMessageHandleResult> {
    try {
      console.log(`Processing speech payload: ${payload.id}`, payload)

      // 発話テキストの検証
      if (!payload.text || payload.text.trim().length === 0) {
        return {
          success: false,
          error: 'Empty speech text',
          messageId: payload.id,
        }
      }

      // 感情表現の適用（Live2D/VRMの場合）
      if (payload.emotion) {
        await this.applyEmotion(payload.emotion)
      }

      // Talkオブジェクトを作成
      const talk: Talk = this.createTalkFromPayload(payload)

      // 発話を実行
      this.executeSpeech(talk, payload)

      return {
        success: true,
        messageId: payload.id,
      }
    } catch (error) {
      console.error('Error processing speech payload:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        messageId: payload.id,
      }
    }
  }

  /**
   * 発話ペイロードからTalkオブジェクトを作成
   */
  private createTalkFromPayload(payload: SpeechPayload): Talk {
    return {
      emotion: (payload.emotion || 'neutral') as EmotionType,
      message: payload.text,
    }
  }

  /**
   * 感情表現を適用
   */
  private async applyEmotion(emotion: string): Promise<void> {
    try {
      // 感情表現はspeakCharacter内でTalkオブジェクトから処理される
      console.log(`Applied emotion: ${emotion}`)
    } catch (error) {
      console.warn('Failed to apply emotion:', error)
    }
  }

  /**
   * 発話を実行
   */
  private executeSpeech(talk: Talk, payload: SpeechPayload): void {
    try {
      // セッションIDを生成
      const sessionId = generateMessageId()

      // 優先度に基づく処理の調整
      if (payload.priority === 'high') {
        // 高優先度の場合、現在の発話を中断して即座に処理
        this.speakWithHighPriority(sessionId, talk)
      } else {
        // 通常の発話処理
        speakCharacter(sessionId, talk)
      }

      console.log(`Speech executed successfully for message: ${payload.id}`)
    } catch (error) {
      console.error('Failed to execute speech:', error)
      throw error
    }
  }

  /**
   * 高優先度の発話処理
   */
  private speakWithHighPriority(sessionId: string, talk: Talk): void {
    try {
      // 現在の発話を停止
      const { SpeakQueue } = require('@/features/messages/speakQueue')
      SpeakQueue.stopAll()

      // 少し待ってから新しい発話を開始
      setTimeout(() => {
        // 高優先度発話を実行
        speakCharacter(sessionId, talk)
      }, 100)
    } catch (error) {
      console.error('High priority speech execution failed:', error)
      throw error
    }
  }

  /**
   * 発話タイプに基づく前処理
   */
  private preprocessSpeechText(payload: SpeechPayload): string {
    let text = payload.text.trim()

    // タイプ別の前処理
    switch (payload.type) {
      case 'alert':
        // アラートの場合、緊急性を示すプレフィックスを追加
        if (!text.match(/^(緊急|アラート|警告)/)) {
          text = `アラート：${text}`
        }
        break

      case 'notification':
        // 通知の場合、情報であることを示すプレフィックスを追加
        if (!text.match(/^(お知らせ|通知|情報)/)) {
          text = `お知らせ：${text}`
        }
        break

      case 'speech':
      default:
        // 通常の発話はそのまま
        break
    }

    return text
  }

  /**
   * エラーハンドリング用のデフォルト発話
   */
  async handleError(error: Error, payload?: SpeechPayload): Promise<void> {
    try {
      const errorMessage = 'メッセージの処理中にエラーが発生しました。'

      const errorTalk: Talk = {
        emotion: 'sad',
        message: errorMessage,
      }

      await speakCharacter(errorMessage, errorTalk)
    } catch (speechError) {
      console.error('Failed to speak error message:', speechError)
    }
  }

  /**
   * ハンドラーの設定を更新
   */
  updateConfiguration(config: any): void {
    // 必要に応じて設定を更新
    console.log('Speech handler configuration updated:', config)
  }

  /**
   * リソースをクリーンアップ
   */
  cleanup(): void {
    this.live2dHandler = undefined
  }
}
