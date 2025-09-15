import React, { useState } from "react";
import { supabase } from "@/lib/supabase";

export default function AccessRequestPage() {
  const [email, setEmail] = useState("");
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true); setMsg(null); setErr(null);
    try {
      const { error } = await supabase.from("access_requests").insert({
        email, note,
      });
      if (error) throw error;
      setMsg("送信しました。審査結果をお待ちください。");
      setEmail(""); setNote("");
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "送信に失敗しました。");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-pink-900 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-black/20 backdrop-blur-sm rounded-lg p-6 border border-white/10">
        <h1 className="text-2xl font-semibold mb-6 text-white text-center">アクセス申請</h1>
        <form onSubmit={submit} className="space-y-4">
          <div>
            <input
              type="email"
              required
              placeholder="メールアドレス"
              className="w-full border border-white/20 rounded-lg px-4 py-3 bg-black/30 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={loading}
            />
          </div>
          <div>
            <textarea
              placeholder="申請理由やメモ（任意）"
              className="w-full border border-white/20 rounded-lg px-4 py-3 h-32 bg-black/30 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              disabled={loading}
            />
          </div>
          <button
            type="submit"
            disabled={loading || !email.trim()}
            className="w-full py-3 rounded-lg bg-gradient-to-r from-purple-600 to-pink-600 text-white font-medium hover:from-purple-700 hover:to-pink-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
          >
            {loading ? "送信中..." : "申請する"}
          </button>
        </form>
        
        {msg && (
          <div className="mt-4 p-3 rounded-lg bg-green-500/20 border border-green-500/30">
            <p className="text-green-400 text-sm">{msg}</p>
          </div>
        )}
        
        {err && (
          <div className="mt-4 p-3 rounded-lg bg-red-500/20 border border-red-500/30">
            <p className="text-red-400 text-sm">{err}</p>
          </div>
        )}
        
        <div className="mt-6 text-center">
          <p className="text-gray-400 text-sm">
            既にアカウントをお持ちの方は
            <a href="/login" className="text-purple-400 hover:text-purple-300 ml-1">
              ログイン
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}