import type { NextApiRequest, NextApiResponse } from 'next'
import axios from 'axios'

type Data = {
  audio?: ArrayBuffer
  error?: string
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<Data>
) {
  const { text, speaker, speed, pitch, intonation, serverUrl } = req.body
  const apiUrl =
    serverUrl || process.env.VOICEVOX_SERVER_URL || 'http://localhost:50021'

  try {
    // テキストの長さ制限（VOICEVOXの推奨値）
    if (text.length > 200) {
      return res.status(400).json({ error: 'テキストが長すぎます（200文字以内）' })
    }

    // 1. Audio Query の生成 - POSTボディでテキストを送信
    const queryResponse = await axios.post(
      `${apiUrl}/audio_query?speaker=${speaker}`,
      text,
      {
        headers: {
          'Content-Type': 'text/plain; charset=utf-8',
        },
        timeout: 30000,
      }
    )

    const queryData = queryResponse.data
    queryData.speedScale = speed
    queryData.pitchScale = pitch
    queryData.intonationScale = intonation

    // 2. 音声合成
    const synthesisResponse = await axios.post(
      `${apiUrl}/synthesis?speaker=${speaker}`,
      queryData,
      {
        headers: {
          'Content-Type': 'application/json',
          Accept: 'audio/wav',
        },
        responseType: 'stream',
        timeout: 30000,
      }
    )

    res.setHeader('Content-Type', 'audio/wav')
    synthesisResponse.data.pipe(res)
  } catch (error) {
    console.error('Error in VOICEVOX TTS:', error)
    
    // 詳細なエラー情報を提供
    if (axios.isAxiosError(error)) {
      const axiosError = error as any
      console.error('VOICEVOX API Error Details:', {
        status: axiosError.response?.status,
        data: axiosError.response?.data,
        message: axiosError.message,
        url: axiosError.config?.url
      })
      
      if (axiosError.response?.status === 422) {
        return res.status(422).json({ 
          error: 'VOICEVOXでテキスト処理エラーが発生しました。テキストに問題がある可能性があります。' 
        })
      }
      
      return res.status(500).json({ 
        error: `VOICEVOX APIエラー: ${axiosError.response?.status || 'Unknown'} - ${axiosError.message}` 
      })
    }
    
    res.status(500).json({ error: `VOICEVOX TTS処理エラー: ${error instanceof Error ? error.message : 'Unknown error'}` })
  }
}
