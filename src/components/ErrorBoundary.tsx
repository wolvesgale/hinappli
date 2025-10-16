"use client"
import { Component, type ReactNode } from 'react'

interface State {
  err?: unknown
}

export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { err: undefined }

  static getDerivedStateFromError(err: unknown): State {
    return { err }
  }

  componentDidCatch(err: unknown) {
    console.error('[ui-error]', err)
  }

  render() {
    if (this.state.err) {
      return (
        <div className="p-4 text-sm text-red-300 bg-red-950/30 rounded-lg">
          画面の描画に失敗しました。再読み込みしてください。詳細はコンソールをご確認ください。
        </div>
      )
    }

    return this.props.children
  }
}
