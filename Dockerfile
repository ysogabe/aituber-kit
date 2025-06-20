# マルチステージビルド: ビルドステージ  
FROM node:20-bullseye-slim AS builder

# canvas用の必要最小限のビルドツールをインストール
RUN apt-get update && apt-get install -y \
    python3 \
    build-essential \
    pkg-config \
    libcairo2-dev \
    libpango1.0-dev \
    libjpeg-dev \
    libgif-dev \
    librsvg2-dev \
    && rm -rf /var/lib/apt/lists/*

# 作業ディレクトリを設定
WORKDIR /app

# package.jsonとpackage-lock.jsonをコピー
COPY package*.json ./

# 全ての依存関係をインストール（開発依存関係含む）
RUN npm ci

# アプリケーションのソースコードをコピー
COPY . .

# Next.jsアプリケーションをビルド
RUN npm run build

# プロダクションステージ
FROM node:20-bullseye-slim AS production

# canvas用ランタイムライブラリとヘルスチェック用ツールをインストール  
RUN apt-get update && apt-get install -y \
    libcairo2 \
    libpango-1.0-0 \
    libjpeg62-turbo \
    libgif7 \
    librsvg2-2 \
    wget \
    && rm -rf /var/lib/apt/lists/*

# 非rootユーザーを作成 (Debian形式)
RUN groupadd -g 1001 nodejs && \
    useradd -r -u 1001 -g nodejs nextjs

# 作業ディレクトリを設定
WORKDIR /app

# package.jsonとpackage-lock.jsonをコピー
COPY package*.json ./

# プロダクション依存関係のみをインストール
RUN npm ci --omit=dev && npm cache clean --force

# ビルドステージから必要なファイルをコピー
COPY --from=builder --chown=nextjs:nodejs /app/.next ./.next
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

# Next.jsの設定ファイルをコピー
COPY --chown=nextjs:nodejs next.config.js ./

# 3000番ポートを公開
EXPOSE 3000

# 非rootユーザーに切り替え
USER nextjs

# 環境変数を設定
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# プロダクションモードでアプリケーションを起動
CMD ["npx", "next", "start", "--hostname", "0.0.0.0", "--port", "3000"]
