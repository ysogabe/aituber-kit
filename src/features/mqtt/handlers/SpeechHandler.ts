import { SpeechPayload, MqttMessageHandleResult } from '../types'
import { Talk, EmotionType, Message } from '@/features/messages/messages'
import { speakCharacter } from '@/features/messages/speakCharacter'
import settingsStore from '@/features/stores/settings'
import homeStore from '@/features/stores/home'
import { Live2DHandler } from '@/features/messages/live2dHandler'
import { generateMessageId } from '@/utils/messageUtils'
import {
  useMqttBrokerStore,
  type SendMode,
} from '@/features/stores/mqttBrokerSettings'
import { getAIChatResponseStream } from '@/features/chat/aiChatFactory'

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

      // 送信モードを取得
      const sendMode = useMqttBrokerStore.getState().sendMode
      console.log(`Processing with send mode: ${sendMode}`)

      // 送信モードに応じて処理を分岐
      await this.processBySendMode(payload, sendMode)

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
   * 送信モードに応じてペイロードを処理
   */
  private async processBySendMode(
    payload: SpeechPayload,
    sendMode: SendMode
  ): Promise<void> {
    switch (sendMode) {
      case 'direct_send':
        await this.processDirectSend(payload)
        break
      case 'ai_generated':
        await this.processAiGenerated(payload)
        break
      case 'user_input':
        await this.processUserInput(payload)
        break
      default:
        console.warn(`Unknown send mode: ${sendMode}, using direct_send`)
        await this.processDirectSend(payload)
    }
  }

  /**
   * 直接送信モード: 受信したメッセージをそのまま発話
   */
  private async processDirectSend(payload: SpeechPayload): Promise<void> {
    const processedText = this.preprocessSpeechText(payload)
    const talk = this.createTalkFromPayload({ ...payload, text: processedText })

    // 感情表現の適用
    if (payload.emotion) {
      await this.applyEmotion(payload.emotion)
    }

    this.executeSpeech(talk, payload)
  }

  /**
   * AI生成モード: 受信したメッセージをAIが処理して自然な発話を生成
   */
  private async processAiGenerated(payload: SpeechPayload): Promise<void> {
    try {
      // AIにメッセージを処理させて自然な発話を生成
      const aiPrompt = `以下のメッセージを自然で親しみやすい話し方に変換して発話してください：「${payload.text}」`

      // AI応答を生成（チャット機能を使用）
      const aiResponse = await this.generateAiResponse(aiPrompt)

      if (aiResponse) {
        const aiTalk = this.createTalkFromPayload({
          ...payload,
          text: aiResponse,
          emotion: payload.emotion || 'happy', // AI生成時はデフォルトで明るい感情
        })

        if (payload.emotion) {
          await this.applyEmotion(payload.emotion)
        }

        this.executeSpeech(aiTalk, payload)
      } else {
        // AI生成に失敗した場合は直接送信にフォールバック
        console.warn(
          'AI response generation failed, falling back to direct send'
        )
        await this.processDirectSend(payload)
      }
    } catch (error) {
      console.error('AI generation failed:', error)
      await this.processDirectSend(payload) // フォールバック
    }
  }

  /**
   * ユーザー入力モード: 受信したメッセージをユーザー入力として扱い、AIが応答
   */
  private async processUserInput(payload: SpeechPayload): Promise<void> {
    try {
      console.log(`[User Input Mode] Processing user input: "${payload.text}"`)

      // ユーザー入力として処理し、AI応答を生成
      const aiResponse = await this.generateAiResponse(payload.text)

      console.log(`[User Input Mode] AI response: "${aiResponse}"`)

      if (aiResponse && aiResponse.trim().length > 0) {
        console.log(`[User Input Mode] Using AI response for speech`)
        const responseTalk = this.createTalkFromPayload({
          ...payload,
          text: aiResponse.trim(),
          emotion: payload.emotion || 'neutral',
        })

        if (payload.emotion) {
          await this.applyEmotion(payload.emotion)
        }

        this.executeSpeech(responseTalk, payload)
      } else {
        console.log(
          `[User Input Mode] AI response failed, using default response`
        )
        // AI応答生成に失敗した場合のデフォルト応答
        const defaultResponse = 'すみません、よく理解できませんでした'
        const defaultTalk = this.createTalkFromPayload({
          ...payload,
          text: defaultResponse,
          emotion: 'sad',
        })

        await this.applyEmotion('sad')
        this.executeSpeech(defaultTalk, payload)
      }
    } catch (error) {
      console.error('[User Input Mode] Processing failed:', error)
      console.log(`[User Input Mode] Falling back to direct send`)
      await this.processDirectSend(payload) // フォールバック
    }
  }

  /**
   * AI応答を生成
   */
  private async generateAiResponse(input: string): Promise<string | null> {
    try {
      console.log(`[AI Response] Generating response for: "${input}"`)
      const ss = settingsStore.getState()

      const messages: Message[] = [
        {
          role: 'system',
          content: ss.systemPrompt || 'You are a friendly AI assistant.',
        },
        {
          role: 'user',
          content: input,
        },
      ]

      console.log(
        `[AI Response] Calling getAIChatResponseStream with ${messages.length} messages`
      )
      const stream = await getAIChatResponseStream(messages)
      if (!stream) {
        console.warn(
          `[AI Response] No stream returned from getAIChatResponseStream`
        )
        return null
      }

      console.log(`[AI Response] Reading stream...`)
      const reader = stream.getReader()
      let fullResponse = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        if (value) {
          fullResponse += value
          console.log(`[AI Response] Received chunk: "${value}"`)
        }
      }

      const trimmedResponse = fullResponse.trim()
      console.log(`[AI Response] Final response: "${trimmedResponse}"`)
      return trimmedResponse || null
    } catch (error) {
      console.error('[AI Response] Failed to generate AI response:', error)
      return null
    }
  }

  /**
   * 発話ペイロードからTalkオブジェクトを作成
   */
  private createTalkFromPayload(payload: SpeechPayload): Talk {
    // テキストをサニタイズしてVOICEVOXエラーを防ぐ
    const sanitizedText = this.sanitizeTextForTTS(payload.text)

    return {
      emotion: (payload.emotion || 'neutral') as EmotionType,
      message: sanitizedText,
    }
  }

  /**
   * TTS用にテキストをサニタイズ
   */
  private sanitizeTextForTTS(text: string): string {
    if (!text) return ''

    // 基本的なクリーニング
    let sanitized = text.trim()

    // 異常な文字や制御文字を除去
    sanitized = sanitized.replace(/[\x00-\x1F\x7F-\x9F]/g, '')

    // 連続するスペースを一つに統一
    sanitized = sanitized.replace(/\s+/g, ' ')

    // VOICEVOXの文字数制限（200文字）を適用
    if (sanitized.length > 200) {
      console.warn(
        `[TTS Sanitize] Text too long (${sanitized.length} chars), truncating to 200 chars`
      )
      // 文の途中で切れないよう、句読点で区切りながら短縮
      sanitized = this.truncateTextGracefully(sanitized, 200)
    }

    // URLエンコードで問題を起こす可能性のある文字をチェック
    try {
      encodeURIComponent(sanitized)
    } catch (error) {
      console.warn(
        `[TTS Sanitize] Text encoding failed, using fallback: ${error}`
      )
      return 'メッセージを処理できませんでした'
    }

    console.log(
      `[TTS Sanitize] Original: "${text}" -> Sanitized: "${sanitized}"`
    )
    return sanitized
  }

  /**
   * テキストを指定した長さで適切に切り詰める
   */
  private truncateTextGracefully(text: string, maxLength: number): string {
    if (text.length <= maxLength) return text

    // 句読点や区切り文字での分割を試行
    const breakPoints = ['。', '！', '？', '、', '，', ' ', '　']
    
    for (let i = maxLength - 1; i >= maxLength * 0.7; i--) {
      if (breakPoints.includes(text[i])) {
        return text.substring(0, i + 1)
      }
    }

    // 適切な区切り位置が見つからない場合は、「...」を付けて切り詰め
    return text.substring(0, maxLength - 3) + '...'
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
      // テキストのバリデーション
      if (!talk.message || talk.message.trim().length === 0) {
        console.warn(`Empty speech text for message: ${payload.id}`)
        return
      }

      // セッションIDを生成
      const sessionId = generateMessageId()

      // コールバック関数を定義
      const onStart = () => {
        console.log(`Started speech for MQTT message: ${payload.id}`)
      }

      const onComplete = () => {
        console.log(`Completed speech for MQTT message: ${payload.id}`)
      }

      // 優先度に基づく処理の調整
      if (payload.priority === 'high') {
        // 高優先度の場合、現在の発話を中断して即座に処理
        this.speakWithHighPriority(sessionId, talk, onStart, onComplete)
      } else {
        // 通常の発話処理
        speakCharacter(sessionId, talk, onStart, onComplete)
      }

      console.log(`Speech executed successfully for message: ${payload.id}`)
    } catch (error) {
      console.error('Failed to execute speech:', error)
      throw error
    }
  }

  /**
   * 高優先度の発話処理
   * WebSocketからの発話も含めてすべて中断し、緊急メッセージを優先
   */
  private speakWithHighPriority(
    sessionId: string,
    talk: Talk,
    onStart: () => void,
    onComplete: () => void
  ): void {
    try {
      console.log(`[High Priority] Interrupting all speech for urgent message: ${talk.message}`)
      
      // すべての発話を強制停止（WebSocket発話も含む）
      const { SpeakQueue } = require('@/features/messages/speakQueue')
      SpeakQueue.stopAll()

      // 緊急用のセッションIDを生成（MQTT-URGENT-プレフィックス）
      const urgentSessionId = `MQTT-URGENT-${Date.now()}`

      // 短い遅延後に高優先度発話を実行
      setTimeout(() => {
        console.log(`[High Priority] Starting urgent speech with session: ${urgentSessionId}`)
        speakCharacter(urgentSessionId, talk, onStart, onComplete)
      }, 50) // WebSocketより高速に実行
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
      const sessionId = generateMessageId()

      const errorTalk: Talk = {
        emotion: 'sad',
        message: errorMessage,
      }

      speakCharacter(sessionId, errorTalk)
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
