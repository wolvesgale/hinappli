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
    } catch (e: any) {
      setErr(e.message ?? "送信に失敗しました。");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-md mx-auto p-6">
      <h1 className="text-xl font-semibold mb-4">アクセス申請</h1>
      <form onSubmit={submit} className="space-y-3">
        <input
          type="email"
          required
          placeholder="メールアドレス"
          className="w-full border rounded px-3 py-2 bg-black/30"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <textarea
          placeholder="申請理由やメモ"
          className="w-full border rounded px-3 py-2 h-28 bg-black/30"
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
        <button
          disabled={loading}
          className="w-full py-2 rounded bg-white/10 hover:bg-white/20"
        >
          {loading ? "送信中..." : "申請する"}
        </button>
      </form>
      {msg && <p className="text-green-400 mt-3">{msg}</p>}
      {err && <p className="text-red-400 mt-3">{err}</p>}
    </div>
  );
}