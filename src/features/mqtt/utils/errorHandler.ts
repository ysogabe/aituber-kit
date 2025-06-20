/**
 * MQTT接続エラーハンドリングユーティリティ
 */

export interface MqttErrorInfo {
  code: string
  message: string
  details: string
  suggestions: string[]
}

/**
 * MQTT接続エラーを分析して詳細な情報を提供
 */
export function analyzeMqttError(error: Error): MqttErrorInfo {
  const message = error.message.toLowerCase()

  // 接続タイムアウト
  if (message.includes('timeout')) {
    return {
      code: 'CONNECTION_TIMEOUT',
      message: '接続がタイムアウトしました',
      details: 'MQTTブローカーへの接続が指定時間内に完了しませんでした。',
      suggestions: [
        'ブローカーのホスト名とポート番号を確認してください',
        'ネットワーク接続を確認してください',
        'ファイアウォール設定を確認してください',
        'ブローカーが起動していることを確認してください',
      ],
    }
  }

  // 接続拒否
  if (
    message.includes('connection refused') ||
    message.includes('econnrefused')
  ) {
    return {
      code: 'CONNECTION_REFUSED',
      message: '接続が拒否されました',
      details: 'MQTTブローカーが接続を受け入れませんでした。',
      suggestions: [
        'ブローカーのホスト名とポート番号を確認してください',
        'ブローカーが起動していることを確認してください',
        'ポートが正しく開放されていることを確認してください',
        'セキュリティグループやファイアウォール設定を確認してください',
      ],
    }
  }

  // 認証エラー
  if (
    message.includes('authentication') ||
    message.includes('unauthorized') ||
    message.includes('bad username or password')
  ) {
    return {
      code: 'AUTHENTICATION_FAILED',
      message: '認証に失敗しました',
      details: 'ユーザー名またはパスワードが正しくありません。',
      suggestions: [
        'ユーザー名とパスワードを確認してください',
        'ブローカーの認証設定を確認してください',
        '大文字小文字の区別に注意してください',
        'ブローカーのアクセス制御リスト（ACL）を確認してください',
      ],
    }
  }

  // SSL/TLS エラー
  if (
    message.includes('ssl') ||
    message.includes('tls') ||
    message.includes('certificate')
  ) {
    return {
      code: 'SSL_TLS_ERROR',
      message: 'SSL/TLS接続エラー',
      details: 'セキュア接続の確立に失敗しました。',
      suggestions: [
        '証明書が正しく設定されていることを確認してください',
        'セキュア接続設定（SSL/TLS）を確認してください',
        '自己署名証明書の場合は設定を調整してください',
        'ブローカーがSSL/TLSをサポートしていることを確認してください',
      ],
    }
  }

  // ネットワークエラー
  if (
    message.includes('network') ||
    message.includes('dns') ||
    message.includes('getaddrinfo')
  ) {
    return {
      code: 'NETWORK_ERROR',
      message: 'ネットワークエラー',
      details: 'ネットワーク関連の問題が発生しました。',
      suggestions: [
        'インターネット接続を確認してください',
        'ホスト名が正しく解決できることを確認してください',
        'DNSサーバー設定を確認してください',
        'プロキシ設定がある場合は確認してください',
      ],
    }
  }

  // WebSocket エラー
  if (message.includes('websocket') || message.includes('ws')) {
    return {
      code: 'WEBSOCKET_ERROR',
      message: 'WebSocket接続エラー',
      details: 'WebSocket接続の確立に失敗しました。',
      suggestions: [
        'WebSocketパス設定を確認してください（例: /mqtt）',
        'ブローカーがWebSocketをサポートしていることを確認してください',
        'ポート番号がWebSocket用であることを確認してください',
        'プロキシやロードバランサーの設定を確認してください',
      ],
    }
  }

  // プロトコルエラー
  if (message.includes('protocol') || message.includes('mqtt')) {
    return {
      code: 'PROTOCOL_ERROR',
      message: 'MQTTプロトコルエラー',
      details: 'MQTTプロトコルレベルでの問題が発生しました。',
      suggestions: [
        'クライアントIDが正しく設定されていることを確認してください',
        'MQTTブローカーのバージョンを確認してください',
        'プロトコル設定（MQTT vs WebSocket）を確認してください',
        'ブローカーの設定ファイルを確認してください',
      ],
    }
  }

  // 一般的なエラー
  return {
    code: 'UNKNOWN_ERROR',
    message: '不明なエラー',
    details: error.message || '詳細不明なエラーが発生しました。',
    suggestions: [
      'ブローカーの設定全体を再確認してください',
      'ブローカーのログを確認してください',
      'ネットワーク設定を確認してください',
      'しばらく時間をおいて再試行してください',
    ],
  }
}

/**
 * エラー情報をユーザーフレンドリーな形式でフォーマット
 */
export function formatMqttError(errorInfo: MqttErrorInfo): string {
  const suggestions = errorInfo.suggestions
    .map((suggestion, index) => `${index + 1}. ${suggestion}`)
    .join('\n')

  return `${errorInfo.message}\n\n詳細: ${errorInfo.details}\n\n対処法:\n${suggestions}`
}

/**
 * 設定診断を実行
 */
export interface ConfigDiagnostic {
  valid: boolean
  issues: string[]
  warnings: string[]
}

export function diagnoseMqttConfig(config: {
  enabled: boolean
  host: string
  port: number
  clientId: string
  protocol: 'mqtt' | 'websocket'
  websocketPath?: string
  secure: boolean
  username?: string
  password?: string
}): ConfigDiagnostic {
  const issues: string[] = []
  const warnings: string[] = []

  // 基本設定の検証
  if (!config.host || config.host.trim() === '') {
    issues.push('ホスト名が設定されていません')
  } else if (config.host === 'localhost' || config.host === '127.0.0.1') {
    warnings.push('localhostを使用しています。外部からアクセスできません')
  }

  if (config.port <= 0 || config.port > 65535) {
    issues.push('ポート番号が無効です（1-65535の範囲で設定してください）')
  } else {
    // 一般的なMQTTポートの確認
    const standardPorts = {
      1883: 'MQTT (非セキュア)',
      8883: 'MQTT over SSL/TLS',
      8080: 'MQTT over WebSocket',
      8084: 'MQTT over WebSocket (SSL)',
    }
    if (standardPorts[config.port as keyof typeof standardPorts]) {
      warnings.push(
        `ポート ${config.port} は ${standardPorts[config.port as keyof typeof standardPorts]} で使用されます`
      )
    }
  }

  if (!config.clientId || config.clientId.trim() === '') {
    issues.push('クライアントIDが設定されていません')
  } else if (config.clientId.length > 65535) {
    issues.push('クライアントIDが長すぎます（65535文字以下にしてください）')
  }

  // WebSocket設定の検証
  if (config.protocol === 'websocket') {
    if (!config.websocketPath || config.websocketPath.trim() === '') {
      issues.push('WebSocketパスが設定されていません')
    } else if (!config.websocketPath.startsWith('/')) {
      warnings.push('WebSocketパスは "/" で始まることが推奨されます')
    }
  }

  // セキュリティ設定の検証
  if (config.secure && config.port === 1883) {
    warnings.push('セキュア接続が有効ですが、ポート1883は通常非セキュアです')
  }
  if (!config.secure && config.port === 8883) {
    warnings.push(
      'ポート8883は通常セキュア接続用ですが、セキュア接続が無効です'
    )
  }

  // 認証設定の検証
  if (config.username && !config.password) {
    warnings.push(
      'ユーザー名が設定されていますが、パスワードが設定されていません'
    )
  }
  if (!config.username && config.password) {
    warnings.push(
      'パスワードが設定されていますが、ユーザー名が設定されていません'
    )
  }

  return {
    valid: issues.length === 0,
    issues,
    warnings,
  }
}
