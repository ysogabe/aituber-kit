# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

AITuberKit is a web application toolkit for creating interactive AI characters with VTuber capabilities. It supports multiple AI providers, character models (VRM/Live2D), and voice synthesis engines.

## Common Commands

### Development

```bash
npm run dev         # Start development server (http://localhost:3000)
npm run build       # Build for production
npm run start       # Start production server
npm run desktop     # Run as Electron desktop app
```

### Testing & Quality

```bash
npm test           # Run all tests
npm run lint       # Run ESLint
```

### Setup

```bash
npm install        # Install dependencies (requires Node.js 20.0.0+, npm 10.0.0+)
cp .env.example .env  # Configure environment variables
```

## MVP Version Limitations

### MQTT Function Restrictions

During the MVP phase, the MQTT integration has the following limitations:

- **Fixed Topic**: Currently uses a hardcoded topic `aituber/speech` with QoS 2
- **No Topic Configuration**: Topic and payload settings cannot be changed through the UI
- **Limited Payload Options**: Advanced payload configuration is not available
- **Next Phase Features**: Topic/payload configuration functionality will be implemented in the next development phase

### Implementation Details

- **Auto-subscription**: When MQTT is enabled and connected, the system automatically subscribes to `aituber/speech` topic
- **Message Handling**: Received messages are logged to console for MVP validation
- **Settings UI**: Shows notification about MVP limitations in the MQTT broker settings panel

## Architecture

### Tech Stack

- **Framework**: Next.js 14.2.5 with React 18.3.1
- **Language**: TypeScript 5.0.2 (strict mode)
- **Styling**: Tailwind CSS 3.4.14
- **State**: Zustand 4.5.4
- **Testing**: Jest with React Testing Library

### Key Directories

- `/src/components/` - React components (VRM viewer, Live2D, chat UI)
- `/src/features/` - Core logic (chat, voice synthesis, messages)
- `/src/pages/api/` - Next.js API routes
- `/src/stores/` - Zustand state management
- `/public/` - Static assets (models, backgrounds)

### AI Integration Points

- **Chat**: `/src/features/chat/` - Factory pattern for multiple providers
- **Voice**: `/src/features/messages/synthesizeVoice*.ts` - 13 TTS engines
- **Models**: VRM (3D) in `/src/features/vrmViewer/`, Live2D (2D) support

### Important Patterns

1. **AI Provider Factory**: `aiChatFactory.ts` manages different LLM providers with dynamic attribute-based model management via `/src/features/constants/aiModels.ts`
2. **Message Queue**: `speakQueue.ts` handles TTS playback sequentially with dynamic model attribute checking for multimodal support
3. **WebSocket**: Real-time features in `/src/utils/WebSocketManager.ts`
4. **i18n**: Multi-language support via `next-i18next`

## Development Guidelines

### From .cursorrules

- Maintain existing UI/UX design without unauthorized changes
- Don't upgrade package versions without explicit approval
- Check for duplicate implementations before adding features
- Follow the established directory structure
- API clients should be centralized in `app/lib/api/client.ts`

### TDD Development Rules

- **テスト失敗の分析**: テストが失敗した場合、なぜ失敗したかを十分に検討し、実装計画に記載する
- **適切な実装変更**: テストを通すためのハードコーディングや汎用的ではない修正は行わない
- **設計書との整合性**: 設計書の内容と異なる実装の変更は行わない
- **実装変更時の通知**: 修正が必要な場合は、mosquitto_pubで以下のコマンドを実行して通知する：
  ```bash
  mosquitto_pub -h 192.168.0.131 -t "aituber/speech" -m '{
    "id": "implementation-change-notification",
    "text": "実装計画に変更が必要です",
    "type": "alert", 
    "priority": "high",
    "timestamp": "2025-06-19T00:00:00.000Z"
  }'
  ```

### Testing

- Place tests in `__tests__` directories
- Mock canvas for Node.js environment (already configured)
- Run specific tests with Jest pattern matching

### Environment Variables

Required API keys vary by features used (OpenAI, Google, Azure, etc.). Check `.env.example` for all available options.

## MQTT通知方法

### 構造化ペイロード形式（必須）
MQTTでAITuberに通知する場合は、以下の構造化JSON形式を使用してください：

```bash
mosquitto_pub -h 192.168.0.131 -t "aituber/speech" -m '{
  "id": "unique-message-id",
  "text": "通知内容のテキスト",
  "type": "speech",
  "priority": "medium",
  "timestamp": "2025-06-19T12:00:00.000Z"
}'
```

### パラメータ仕様
- **host**: 192.168.0.131
- **topic**: aituber/speech (固定、QoS: 2)
- **id**: 一意のメッセージID（必須）
- **text**: 発話するテキスト内容（必須）
- **type**: speech | alert | notification（必須）
- **priority**: high | medium | low（必須）
- **timestamp**: ISO 8601形式のタイムスタンプ（必須）

### 注意事項
- **構造化ペイロードが必須**: シンプルテキスト形式では発話されません
- **全パラメータ必須**: id, text, type, priority, timestampすべてが必要
- **JSON形式**: 正しいJSON構文である必要があります

## License Considerations

- Custom license from v2.0.0+
- Free for non-commercial use
- Commercial license required for business use
- Character model usage requires separate licensing

## CRITICAL: GitHub Issue/PR Guidelines

**絶対にフォーク元（tegnike/aituber-kit）にIssueやPRを作成しないこと**

- Issue/PR は必ず自分のフォークリポジトリ（ysogabe/aituber-kit）に作成する
- Issue/PR 作成前に必ず以下を確認：
  1. `gh repo view` でリポジトリ名を確認
  2. リポジトリが `ysogabe/aituber-kit` であることを確認
  3. この CLAUDE.md の本セクションを読んだことを報告する
