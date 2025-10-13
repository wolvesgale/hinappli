import React, { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuthContext } from '../../contexts/AuthProvider'
import { supabase } from '../../lib/supabase'
import type { Transaction as DbTransaction, UserRole } from '../../types/database'

const WEEKDAY_LABELS = ['日', '月', '火', '水', '木', '金', '土']

type PaymentMethod = DbTransaction['payment_method']

const PAYMENT_METHOD_OPTIONS: Array<{ value: PaymentMethod; label: string; accent: string }> = [
  { value: 'cash', label: '現金', accent: 'text-emerald-300' },
  { value: 'paypay_credit', label: 'PayPay / クレジット', accent: 'text-purple-300' },
  { value: 'tsuke', label: 'ツケ', accent: 'text-amber-300' }
]

const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  cash: '現金',
  paypay_credit: 'PayPay / クレジット',
  tsuke: 'ツケ'
}

const formatJstDateKey = (value: string | Date) => {
  const date = typeof value === 'string' ? new Date(value) : value
  const formatted = date.toLocaleString('sv-SE', {
    timeZone: 'Asia/Tokyo'
  })
  return formatted.split(' ')[0]
}

const toDisplayDate = (isoDate: string) => {
  const [year, month, day] = isoDate.split('-')
  return `${year}年${Number(month)}月${Number(day)}日`
}

const getInitialMonth = () => {
  const formatted = new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Tokyo' })
  return formatted.slice(0, 7)
}

interface TransactionEditForm {
  amount: string
  paymentMethod: PaymentMethod
  memo: string
  attributedToEmail: string
}

interface NewTransactionForm {
  amount: string
  paymentMethod: PaymentMethod
  memo: string
  attributedToEmail: string
}

export const SalesCalendar: React.FC = () => {
  const { authUser } = useAuthContext()
  const [currentMonth, setCurrentMonth] = useState(getInitialMonth())
  const [transactionsByDate, setTransactionsByDate] = useState<Record<string, DbTransaction[]>>({})
  const [userRoles, setUserRoles] = useState<UserRole[]>([])
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [editForms, setEditForms] = useState<Record<string, TransactionEditForm>>({})
  const [newTransactionForm, setNewTransactionForm] = useState<NewTransactionForm>({
    amount: '',
    paymentMethod: 'cash',
    memo: '',
    attributedToEmail: ''
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [modalError, setModalError] = useState('')

  const calendarMeta = useMemo(() => {
    const [yearString, monthString] = currentMonth.split('-')
    const year = Number(yearString)
    const monthIndex = Number(monthString) - 1
    const daysInMonth = new Date(year, monthIndex + 1, 0).getDate()
    const firstDay = new Date(year, monthIndex, 1).getDay()

    const cells: Array<{ date: string | null; records: DbTransaction[] }> = []
    for (let i = 0; i < firstDay; i++) {
      cells.push({ date: null, records: [] })
    }

    for (let day = 1; day <= daysInMonth; day++) {
      const dateKey = `${currentMonth}-${String(day).padStart(2, '0')}`
      cells.push({ date: dateKey, records: transactionsByDate[dateKey] || [] })
    }

    return {
      year,
      month: monthIndex + 1,
      cells
    }
  }, [currentMonth, transactionsByDate])

  const selectedTransactions = selectedDate ? transactionsByDate[selectedDate] || [] : []

  useEffect(() => {
    const fetchUsers = async () => {
      const { data, error: rolesError } = await supabase
        .from('user_roles')
        .select('*')
        .order('display_name', { ascending: true })

      if (rolesError) {
        console.error(rolesError)
        setError('ユーザー情報の取得に失敗しました')
        return
      }

      setUserRoles(data || [])
    }

    fetchUsers()
  }, [])

  useEffect(() => {
    const fetchTransactions = async () => {
      setLoading(true)
      setError('')
      try {
        const [yearString, monthString] = currentMonth.split('-')
        const year = Number(yearString)
        const monthIndex = Number(monthString) - 1

        const rangeStart = new Date(Date.UTC(year, monthIndex, 1, -12, 0, 0)).toISOString()
        const rangeEnd = new Date(Date.UTC(year, monthIndex + 1, 1, 12, 0, 0)).toISOString()

        const { data, error: transactionsError } = await supabase
          .from('transactions')
          .select('*')
          .gte('created_at', rangeStart)
          .lt('created_at', rangeEnd)
          .order('created_at', { ascending: true })

        if (transactionsError) {
          throw transactionsError
        }

        const grouped: Record<string, DbTransaction[]> = {}

        ;(data || []).forEach(record => {
          const key = record.biz_date || formatJstDateKey(record.created_at)
          if (!grouped[key]) {
            grouped[key] = []
          }
          grouped[key].push(record)
        })

        Object.keys(grouped).forEach(dateKey => {
          grouped[dateKey].sort((a, b) => a.created_at.localeCompare(b.created_at))
        })

        setTransactionsByDate(grouped)
      } catch (err) {
        console.error(err)
        setError('売上データの取得に失敗しました')
      } finally {
        setLoading(false)
      }
    }

    fetchTransactions()
  }, [currentMonth])

  useEffect(() => {
    if (!selectedDate) return

    const forms: Record<string, TransactionEditForm> = {}
    const records = transactionsByDate[selectedDate] || []
    records.forEach(record => {
      forms[record.id] = {
        amount: record.amount.toString(),
        paymentMethod: record.payment_method,
        memo: record.memo ?? '',
        attributedToEmail: record.attributed_to_email ?? ''
      }
    })

    setEditForms(forms)
    setModalError('')
    setNewTransactionForm({
      amount: '',
      paymentMethod: 'cash',
      memo: '',
      attributedToEmail: ''
    })
  }, [selectedDate, transactionsByDate])

  const changeMonth = (offset: number) => {
    const [yearString, monthString] = currentMonth.split('-')
    const year = Number(yearString)
    const monthIndex = Number(monthString) - 1
    const newDate = new Date(year, monthIndex + offset, 1)
    setCurrentMonth(`${newDate.getFullYear()}-${String(newDate.getMonth() + 1).padStart(2, '0')}`)
  }

  const refresh = async () => {
    const [yearString, monthString] = currentMonth.split('-')
    const year = Number(yearString)
    const monthIndex = Number(monthString) - 1
    const rangeStart = new Date(Date.UTC(year, monthIndex, 1, -12, 0, 0)).toISOString()
    const rangeEnd = new Date(Date.UTC(year, monthIndex + 1, 1, 12, 0, 0)).toISOString()

    const { data, error: transactionsError } = await supabase
      .from('transactions')
      .select('*')
      .gte('created_at', rangeStart)
      .lt('created_at', rangeEnd)
      .order('created_at', { ascending: true })

    if (transactionsError) {
      throw transactionsError
    }

    const grouped: Record<string, DbTransaction[]> = {}

    ;(data || []).forEach(record => {
      const key = record.biz_date || formatJstDateKey(record.created_at)
      if (!grouped[key]) {
        grouped[key] = []
      }
      grouped[key].push(record)
    })

    Object.keys(grouped).forEach(dateKey => {
      grouped[dateKey].sort((a, b) => a.created_at.localeCompare(b.created_at))
    })

    setTransactionsByDate(grouped)
  }

  const handleUpdateTransaction = async (transactionId: string) => {
    const form = editForms[transactionId]
    if (!form) return
    if (!form.amount) {
      setModalError('金額を入力してください')
      return
    }

    const amount = Number(form.amount)
    if (Number.isNaN(amount) || amount <= 0) {
      setModalError('金額は正の数で入力してください')
      return
    }

    setSaving(true)
    setModalError('')

    try {
      const { error: updateError } = await supabase
        .from('transactions')
        .update({
          amount,
          payment_method: form.paymentMethod,
          memo: form.memo || null,
          attributed_to_email: form.attributedToEmail || null
        })
        .eq('id', transactionId)

      if (updateError) throw updateError

      await refresh()
    } catch (err) {
      console.error(err)
      setModalError('売上の更新に失敗しました')
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteTransaction = async (transactionId: string) => {
    if (!confirm('この売上を削除しますか？')) return

    setSaving(true)
    setModalError('')
    try {
      const { error: deleteError } = await supabase
        .from('transactions')
        .delete()
        .eq('id', transactionId)

      if (deleteError) throw deleteError

      await refresh()
    } catch (err) {
      console.error(err)
      setModalError('売上の削除に失敗しました')
    } finally {
      setSaving(false)
    }
  }

  const handleAddTransaction = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!selectedDate) return
    if (!authUser?.user.email) {
      setModalError('作成者情報が取得できません')
      return
    }

    if (!newTransactionForm.amount) {
      setModalError('金額を入力してください')
      return
    }

    const amount = Number(newTransactionForm.amount)
    if (Number.isNaN(amount) || amount <= 0) {
      setModalError('金額は正の数で入力してください')
      return
    }

    setSaving(true)
    setModalError('')

    try {
      const { error: insertError } = await supabase
        .from('transactions')
        .insert({
          biz_date: selectedDate,
          payment_method: newTransactionForm.paymentMethod,
          amount,
          memo: newTransactionForm.memo || null,
          attributed_to_email: newTransactionForm.attributedToEmail || null,
          created_by: authUser.user.email
        })

      if (insertError) throw insertError

      await refresh()
      setNewTransactionForm({ amount: '', paymentMethod: 'cash', memo: '', attributedToEmail: '' })
    } catch (err) {
      console.error(err)
      setModalError('売上の追加に失敗しました')
    } finally {
      setSaving(false)
    }
  }

  const getDisplayName = (email: string | null) => {
    if (!email) return '共通'
    const found = userRoles.find(user => user.email === email)
    return found ? `${found.display_name}（${found.role}）` : email
  }

  const calculateTotals = (records: DbTransaction[]) => {
    const totals: Record<PaymentMethod, number> = {
      cash: 0,
      paypay_credit: 0,
      tsuke: 0
    }

    records.forEach(record => {
      totals[record.payment_method] += record.amount
    })

    return totals
  }

  if (!authUser) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-pink-900 flex items-center justify-center">
        <div className="text-white">認証情報を確認できませんでした。</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-pink-900 text-white">
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">売上カレンダー</h1>
            <p className="text-sm text-gray-300 mt-1">日付をクリックして売上の確認と編集を行えます。</p>
          </div>
          <Link
            to="/admin"
            className="inline-flex items-center justify-center px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 transition"
          >
            ← 管理トップに戻る
          </Link>
        </div>

        <div className="mt-8 flex items-center justify-between bg-white/10 rounded-lg px-4 py-3">
          <button
            onClick={() => changeMonth(-1)}
            className="px-3 py-2 rounded bg-white/10 hover:bg-white/20 transition"
          >
            前月
          </button>
          <div className="text-lg font-semibold">
            {calendarMeta.year}年{calendarMeta.month}月
          </div>
          <button
            onClick={() => changeMonth(1)}
            className="px-3 py-2 rounded bg-white/10 hover:bg-white/20 transition"
          >
            翌月
          </button>
        </div>

        {error && (
          <div className="mt-4 bg-red-500/20 text-red-200 px-4 py-3 rounded-lg">{error}</div>
        )}

        <div className="mt-6 bg-white/5 rounded-lg p-4 sm:p-6 shadow-xl">
          <div className="grid grid-cols-7 gap-2 text-center text-sm text-gray-300 mb-2">
            {WEEKDAY_LABELS.map(label => (
              <div key={label} className="font-semibold uppercase tracking-wide">
                {label}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-2">
            {loading ? (
              <div className="col-span-7 text-center py-10 text-gray-300">読み込み中...</div>
            ) : (
              calendarMeta.cells.map((cell, index) => {
                if (!cell.date) {
                  return <div key={`empty-${index}`} className="h-28 rounded-lg bg-white/5" />
                }

                const totals = calculateTotals(cell.records)
                const dayNumber = Number(cell.date.split('-')[2])

                return (
                  <button
                    key={cell.date}
                    onClick={() => setSelectedDate(cell.date)}
                    className={`h-28 w-full rounded-lg border border-white/10 px-2 py-2 text-left transition focus:outline-none focus:ring-2 focus:ring-pink-400 ${
                      cell.records.length > 0 ? 'bg-indigo-500/10 hover:bg-indigo-500/20' : 'bg-white/5 hover:bg-white/10'
                    } ${selectedDate === cell.date ? 'ring-2 ring-pink-400' : ''}`}
                  >
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-lg font-semibold">{dayNumber}</span>
                      <span className="text-xs text-gray-300">{cell.records.length}件</span>
                    </div>
                    <div className="mt-2 space-y-1 text-xs">
                      {PAYMENT_METHOD_OPTIONS.map(option => (
                        <div key={option.value} className={`${option.accent} flex justify-between`}>
                          <span>{option.label}</span>
                          <span>¥{totals[option.value].toLocaleString()}</span>
                        </div>
                      ))}
                    </div>
                  </button>
                )
              })
            )}
          </div>
        </div>
      </div>

      {selectedDate && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center px-4 py-8 z-50">
          <div className="w-full max-w-4xl bg-gray-900 border border-white/10 rounded-2xl shadow-2xl overflow-hidden max-h-full flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
              <div>
                <h2 className="text-xl font-semibold">{toDisplayDate(selectedDate)} の売上</h2>
                <p className="text-sm text-gray-400 mt-1">売上の追加・編集・削除を行えます。</p>
              </div>
              <button onClick={() => setSelectedDate(null)} className="text-gray-300 hover:text-white">
                閉じる
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-6">
              {modalError && (
                <div className="bg-red-500/20 text-red-200 px-4 py-3 rounded-lg">{modalError}</div>
              )}

              <div className="bg-white/5 border border-white/10 rounded-xl p-4">
                <h3 className="text-lg font-semibold mb-3">区分別合計</h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {(() => {
                    const totals = calculateTotals(selectedTransactions)
                    return PAYMENT_METHOD_OPTIONS.map(option => (
                      <div key={option.value} className="bg-black/30 rounded-lg px-4 py-3 border border-white/10">
                        <div className={`text-sm ${option.accent}`}>{option.label}</div>
                        <div className="text-xl font-bold mt-1">¥{totals[option.value].toLocaleString()}</div>
                      </div>
                    ))
                  })()}
                </div>
              </div>

              {selectedTransactions.length === 0 ? (
                <div className="text-sm text-gray-300">この日の売上データはありません。新規追加してください。</div>
              ) : (
                selectedTransactions.map(transaction => {
                  const form = editForms[transaction.id]
                  return (
                    <div key={transaction.id} className="bg-white/5 rounded-xl border border-white/10 p-4 space-y-4">
                      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                        <div>
                          <div className="text-base font-semibold">
                            {PAYMENT_METHOD_LABELS[transaction.payment_method]}
                          </div>
                          <div className="text-xs text-gray-400">{new Date(transaction.created_at).toLocaleString('ja-JP')}</div>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleDeleteTransaction(transaction.id)}
                            className="px-3 py-1 rounded bg-red-500/20 text-red-200 hover:bg-red-500/30 transition"
                            disabled={saving}
                          >
                            削除
                          </button>
                        </div>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <label className="flex flex-col gap-2 text-sm">
                          <span className="text-gray-300">金額</span>
                          <input
                            type="number"
                            value={form?.amount ?? ''}
                            onChange={event =>
                              setEditForms(prev => ({
                                ...prev,
                                [transaction.id]: {
                                  ...prev[transaction.id],
                                  amount: event.target.value
                                }
                              }))
                            }
                            className="bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white"
                          />
                        </label>
                        <label className="flex flex-col gap-2 text-sm">
                          <span className="text-gray-300">支払方法</span>
                          <select
                            value={form?.paymentMethod ?? 'cash'}
                            onChange={event =>
                              setEditForms(prev => ({
                                ...prev,
                                [transaction.id]: {
                                  ...prev[transaction.id],
                                  paymentMethod: event.target.value as PaymentMethod
                                }
                              }))
                            }
                            className="bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white"
                          >
                            {PAYMENT_METHOD_OPTIONS.map(option => (
                              <option key={option.value} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                        </label>
                      </div>
                      <label className="flex flex-col gap-2 text-sm">
                        <span className="text-gray-300">メモ</span>
                        <textarea
                          value={form?.memo ?? ''}
                          onChange={event =>
                            setEditForms(prev => ({
                              ...prev,
                              [transaction.id]: {
                                ...prev[transaction.id],
                                memo: event.target.value
                              }
                            }))
                          }
                          rows={2}
                          className="bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white"
                        />
                      </label>
                      <label className="flex flex-col gap-2 text-sm">
                        <span className="text-gray-300">売上帰属（任意）</span>
                        <select
                          value={form?.attributedToEmail ?? ''}
                          onChange={event =>
                            setEditForms(prev => ({
                              ...prev,
                              [transaction.id]: {
                                ...prev[transaction.id],
                                attributedToEmail: event.target.value
                              }
                            }))
                          }
                          className="bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white"
                        >
                          <option value="">共通</option>
                          {userRoles.map(user => (
                            <option key={user.email} value={user.email}>
                              {user.display_name}（{user.role}）
                            </option>
                          ))}
                        </select>
                      </label>
                      <div className="text-sm text-gray-400">
                        現在の帰属: {getDisplayName(transaction.attributed_to_email)}
                      </div>
                      <div className="flex justify-end">
                        <button
                          onClick={() => handleUpdateTransaction(transaction.id)}
                          className="px-4 py-2 rounded bg-pink-600 hover:bg-pink-700 transition disabled:opacity-60"
                          disabled={saving}
                        >
                          保存
                        </button>
                      </div>
                    </div>
                  )
                })
              )}

              <div className="bg-white/5 rounded-xl border border-white/10 p-4">
                <h3 className="text-lg font-semibold mb-3">売上の新規追加</h3>
                <form className="space-y-4" onSubmit={handleAddTransaction}>
                  <label className="flex flex-col gap-2 text-sm">
                    <span className="text-gray-300">金額</span>
                    <input
                      type="number"
                      value={newTransactionForm.amount}
                      onChange={event =>
                        setNewTransactionForm(prev => ({
                          ...prev,
                          amount: event.target.value
                        }))
                      }
                      className="bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white"
                    />
                  </label>
                  <label className="flex flex-col gap-2 text-sm">
                    <span className="text-gray-300">支払方法</span>
                    <select
                      value={newTransactionForm.paymentMethod}
                      onChange={event =>
                        setNewTransactionForm(prev => ({
                          ...prev,
                          paymentMethod: event.target.value as PaymentMethod
                        }))
                      }
                      className="bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white"
                    >
                      {PAYMENT_METHOD_OPTIONS.map(option => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="flex flex-col gap-2 text-sm">
                    <span className="text-gray-300">メモ（任意）</span>
                    <textarea
                      value={newTransactionForm.memo}
                      onChange={event =>
                        setNewTransactionForm(prev => ({
                          ...prev,
                          memo: event.target.value
                        }))
                      }
                      rows={2}
                      className="bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white"
                    />
                  </label>
                  <label className="flex flex-col gap-2 text-sm">
                    <span className="text-gray-300">売上帰属（任意）</span>
                    <select
                      value={newTransactionForm.attributedToEmail}
                      onChange={event =>
                        setNewTransactionForm(prev => ({
                          ...prev,
                          attributedToEmail: event.target.value
                        }))
                      }
                      className="bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white"
                    >
                      <option value="">共通</option>
                      {userRoles.map(user => (
                        <option key={user.email} value={user.email}>
                          {user.display_name}（{user.role}）
                        </option>
                      ))}
                    </select>
                  </label>
                  <div className="flex justify-end">
                    <button
                      type="submit"
                      className="px-4 py-2 rounded bg-emerald-600 hover:bg-emerald-700 transition disabled:opacity-60"
                      disabled={saving}
                    >
                      追加
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default SalesCalendar
