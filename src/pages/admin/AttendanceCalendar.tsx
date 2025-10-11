import React, { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuthContext } from '../../contexts/AuthProvider'
import { supabase } from '../../lib/supabase'
import type { Attendance, UserRole } from '../../types/database'

const WEEKDAY_LABELS = ['日', '月', '火', '水', '木', '金', '土']

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

const toDateTimeLocalValue = (isoString: string | null) => {
  if (!isoString) return ''
  const formatted = new Date(isoString).toLocaleString('sv-SE', {
    timeZone: 'Asia/Tokyo'
  })
  return formatted.replace(' ', 'T').slice(0, 16)
}

const toIsoFromLocal = (value: string) => {
  if (!value) return null
  return new Date(`${value}:00+09:00`).toISOString()
}

interface AttendanceEditForm {
  startDateTime: string
  endDateTime: string
  companion: boolean
}

interface NewAttendanceForm {
  userEmail: string
  startDateTime: string
  endDateTime: string
  companion: boolean
}

const getInitialMonth = () => {
  const formatted = new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Tokyo' })
  return formatted.slice(0, 7)
}

export const AttendanceCalendar: React.FC = () => {
  const { authUser } = useAuthContext()
  const [currentMonth, setCurrentMonth] = useState(getInitialMonth())
  const [attendanceByDate, setAttendanceByDate] = useState<Record<string, Attendance[]>>({})
  const [userRoles, setUserRoles] = useState<UserRole[]>([])
  const [userIdCache, setUserIdCache] = useState<Record<string, string | null>>({})
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [editForms, setEditForms] = useState<Record<string, AttendanceEditForm>>({})
  const [newAttendanceForm, setNewAttendanceForm] = useState<NewAttendanceForm>({
    userEmail: '',
    startDateTime: '',
    endDateTime: '',
    companion: false
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

    const cells: Array<{ date: string | null; records: Attendance[] }> = []
    for (let i = 0; i < firstDay; i++) {
      cells.push({ date: null, records: [] })
    }

    for (let day = 1; day <= daysInMonth; day++) {
      const dateKey = `${currentMonth}-${String(day).padStart(2, '0')}`
      cells.push({ date: dateKey, records: attendanceByDate[dateKey] || [] })
    }

    return {
      year,
      month: monthIndex + 1,
      cells
    }
  }, [attendanceByDate, currentMonth])

  const selectedAttendances = selectedDate ? attendanceByDate[selectedDate] || [] : []

  useEffect(() => {
    const fetchUserRoles = async () => {
      const { data, error: rolesError } = await supabase
        .from('user_roles')
        .select('*')
        .order('display_name', { ascending: true })

      if (rolesError) {
        console.error(rolesError)
        setError('ユーザー一覧の取得に失敗しました')
        return
      }

      setUserRoles(data || [])
    }

    fetchUserRoles()
  }, [])

  useEffect(() => {
    const fetchAttendances = async () => {
      setLoading(true)
      setError('')
      try {
        const [yearString, monthString] = currentMonth.split('-')
        const year = Number(yearString)
        const monthIndex = Number(monthString) - 1

        const rangeStart = new Date(Date.UTC(year, monthIndex, 1, -12, 0, 0)).toISOString()
        const rangeEnd = new Date(Date.UTC(year, monthIndex + 1, 1, 12, 0, 0)).toISOString()

        const { data, error: attendanceError } = await supabase
          .from('attendances')
          .select('*')
          .gte('start_time', rangeStart)
          .lt('start_time', rangeEnd)
          .order('start_time', { ascending: true })

        if (attendanceError) {
          throw attendanceError
        }

        const grouped: Record<string, Attendance[]> = {}
        const cache: Record<string, string | null> = {}

        ;(data || []).forEach(record => {
          if (!record.start_time) return
          const key = formatJstDateKey(record.start_time)
          if (!grouped[key]) {
            grouped[key] = []
          }
          grouped[key].push(record)
          if (record.user_email && !(record.user_email in cache)) {
            cache[record.user_email] = record.user_id ?? null
          }
        })

        Object.keys(grouped).forEach(dateKey => {
          grouped[dateKey].sort((a, b) => a.start_time.localeCompare(b.start_time))
        })

        setAttendanceByDate(grouped)
        setUserIdCache(cache)
      } catch (err) {
        console.error(err)
        setError('勤怠データの取得に失敗しました')
      } finally {
        setLoading(false)
      }
    }

    fetchAttendances()
  }, [currentMonth])

  useEffect(() => {
    if (!selectedDate) {
      return
    }

    const forms: Record<string, AttendanceEditForm> = {}
    const records = attendanceByDate[selectedDate] || []
    records.forEach(record => {
      forms[record.id] = {
        startDateTime: toDateTimeLocalValue(record.start_time),
        endDateTime: toDateTimeLocalValue(record.end_time),
        companion: record.companion_checked ?? false
      }
    })

    setEditForms(forms)
    setModalError('')
    setNewAttendanceForm({
      userEmail: '',
      startDateTime: `${selectedDate}T18:00`,
      endDateTime: '',
      companion: false
    })
  }, [attendanceByDate, selectedDate])

  const changeMonth = (offset: number) => {
    const [yearString, monthString] = currentMonth.split('-')
    const year = Number(yearString)
    const monthIndex = Number(monthString) - 1
    const newDate = new Date(year, monthIndex + offset, 1)
    const next = `${newDate.getFullYear()}-${String(newDate.getMonth() + 1).padStart(2, '0')}`
    setCurrentMonth(next)
  }

  const refresh = async () => {
    const [yearString, monthString] = currentMonth.split('-')
    const year = Number(yearString)
    const monthIndex = Number(monthString) - 1
    const rangeStart = new Date(Date.UTC(year, monthIndex, 1, -12, 0, 0)).toISOString()
    const rangeEnd = new Date(Date.UTC(year, monthIndex + 1, 1, 12, 0, 0)).toISOString()

    const { data, error: attendanceError } = await supabase
      .from('attendances')
      .select('*')
      .gte('start_time', rangeStart)
      .lt('start_time', rangeEnd)
      .order('start_time', { ascending: true })

    if (attendanceError) {
      throw attendanceError
    }

    const grouped: Record<string, Attendance[]> = {}
    const cache: Record<string, string | null> = {}

    ;(data || []).forEach(record => {
      if (!record.start_time) return
      const key = formatJstDateKey(record.start_time)
      if (!grouped[key]) {
        grouped[key] = []
      }
      grouped[key].push(record)
      if (record.user_email && !(record.user_email in cache)) {
        cache[record.user_email] = record.user_id ?? null
      }
    })

    Object.keys(grouped).forEach(dateKey => {
      grouped[dateKey].sort((a, b) => a.start_time.localeCompare(b.start_time))
    })

    setAttendanceByDate(grouped)
    setUserIdCache(cache)
  }

  const handleSaveAttendance = async (attendanceId: string) => {
    const form = editForms[attendanceId]
    if (!form) return
    if (!form.startDateTime) {
      setModalError('開始日時を入力してください')
      return
    }

    setSaving(true)
    setModalError('')

    try {
      const updates = {
        start_time: toIsoFromLocal(form.startDateTime),
        end_time: form.endDateTime ? toIsoFromLocal(form.endDateTime) : null,
        companion_checked: form.companion
      }

      const { error: updateError } = await supabase
        .from('attendances')
        .update(updates)
        .eq('id', attendanceId)

      if (updateError) throw updateError

      await refresh()
    } catch (err) {
      console.error(err)
      setModalError('勤怠の更新に失敗しました')
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteAttendance = async (attendanceId: string) => {
    if (!confirm('この勤怠を削除しますか？')) return

    setSaving(true)
    setModalError('')
    try {
      const { error: deleteError } = await supabase
        .from('attendances')
        .delete()
        .eq('id', attendanceId)

      if (deleteError) throw deleteError

      await refresh()
    } catch (err) {
      console.error(err)
      setModalError('勤怠の削除に失敗しました')
    } finally {
      setSaving(false)
    }
  }

  const handleAddAttendance = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!selectedDate) return

    if (!newAttendanceForm.userEmail) {
      setModalError('スタッフを選択してください')
      return
    }
    if (!newAttendanceForm.startDateTime) {
      setModalError('開始日時を入力してください')
      return
    }

    setSaving(true)
    setModalError('')

    try {
      const payload = {
        user_email: newAttendanceForm.userEmail,
        user_id: userIdCache[newAttendanceForm.userEmail] ?? null,
        start_time: toIsoFromLocal(newAttendanceForm.startDateTime),
        end_time: newAttendanceForm.endDateTime ? toIsoFromLocal(newAttendanceForm.endDateTime) : null,
        companion_checked: newAttendanceForm.companion
      }

      const { error: insertError } = await supabase
        .from('attendances')
        .insert(payload)

      if (insertError) throw insertError

      await refresh()
      setNewAttendanceForm({
        userEmail: '',
        startDateTime: `${selectedDate}T18:00`,
        endDateTime: '',
        companion: false
      })
    } catch (err) {
      console.error(err)
      setModalError('勤怠の追加に失敗しました')
    } finally {
      setSaving(false)
    }
  }

  const getDisplayName = (email: string) => {
    const found = userRoles.find(user => user.email === email)
    return found ? `${found.display_name}（${found.role}）` : email
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
            <h1 className="text-2xl font-bold">勤怠カレンダー</h1>
            <p className="text-sm text-gray-300 mt-1">日付をクリックして勤怠の追加・編集ができます。</p>
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

                const companionCount = cell.records.filter(record => record.companion_checked).length

                return (
                  <button
                    key={cell.date}
                    onClick={() => setSelectedDate(cell.date)}
                    className={`h-28 w-full rounded-lg border border-white/10 px-2 py-2 text-left transition focus:outline-none focus:ring-2 focus:ring-pink-400 ${
                      cell.records.length > 0 ? 'bg-pink-500/10 hover:bg-pink-500/20' : 'bg-white/5 hover:bg-white/10'
                    } ${selectedDate === cell.date ? 'ring-2 ring-pink-400' : ''}`}
                  >
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-lg font-semibold">
                        {Number(cell.date.split('-')[2])}
                      </span>
                      <span className="text-xs text-gray-300">
                        {cell.records.length}件
                      </span>
                    </div>
                    {cell.records.length > 0 ? (
                      <div className="mt-2 space-y-1 text-xs text-gray-200">
                        <div>
                          出勤者: {cell.records.slice(0, 3).map(record => getDisplayName(record.user_email)).join(', ')}
                          {cell.records.length > 3 && ' 他'}
                        </div>
                        {companionCount > 0 && (
                          <div className="text-emerald-300">同伴 {companionCount}件</div>
                        )}
                      </div>
                    ) : (
                      <div className="mt-4 text-xs text-gray-400">勤怠なし</div>
                    )}
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
                <h2 className="text-xl font-semibold">{toDisplayDate(selectedDate)} の勤怠</h2>
                <p className="text-sm text-gray-400 mt-1">勤怠の追加・編集・削除を行えます。</p>
              </div>
              <button
                onClick={() => setSelectedDate(null)}
                className="text-gray-300 hover:text-white"
              >
                閉じる
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-6">
              {modalError && (
                <div className="bg-red-500/20 text-red-200 px-4 py-3 rounded-lg">{modalError}</div>
              )}

              {selectedAttendances.length === 0 ? (
                <div className="text-gray-300 text-sm">この日の勤怠データはありません。新規追加してください。</div>
              ) : (
                selectedAttendances.map(attendance => {
                  const form = editForms[attendance.id]
                  return (
                    <div key={attendance.id} className="bg-white/5 rounded-xl border border-white/10 p-4 space-y-4">
                      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                        <div>
                          <div className="text-base font-semibold">
                            {getDisplayName(attendance.user_email)}
                          </div>
                          <div className="text-xs text-gray-400">{attendance.user_email}</div>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleDeleteAttendance(attendance.id)}
                            className="px-3 py-1 rounded bg-red-500/20 text-red-200 hover:bg-red-500/30 transition"
                            disabled={saving}
                          >
                            削除
                          </button>
                        </div>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <label className="flex flex-col gap-2 text-sm">
                          <span className="text-gray-300">開始日時</span>
                          <input
                            type="datetime-local"
                            value={form?.startDateTime ?? ''}
                            onChange={event =>
                              setEditForms(prev => ({
                                ...prev,
                                [attendance.id]: {
                                  ...prev[attendance.id],
                                  startDateTime: event.target.value
                                }
                              }))
                            }
                            className="bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white"
                          />
                        </label>
                        <label className="flex flex-col gap-2 text-sm">
                          <span className="text-gray-300">終了日時</span>
                          <input
                            type="datetime-local"
                            value={form?.endDateTime ?? ''}
                            onChange={event =>
                              setEditForms(prev => ({
                                ...prev,
                                [attendance.id]: {
                                  ...prev[attendance.id],
                                  endDateTime: event.target.value
                                }
                              }))
                            }
                            className="bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white"
                          />
                        </label>
                      </div>
                      <label className="inline-flex items-center gap-2 text-sm text-gray-300">
                        <input
                          type="checkbox"
                          checked={form?.companion ?? false}
                          onChange={event =>
                            setEditForms(prev => ({
                              ...prev,
                              [attendance.id]: {
                                ...prev[attendance.id],
                                companion: event.target.checked
                              }
                            }))
                          }
                          className="h-4 w-4 rounded border-gray-600 bg-gray-800"
                        />
                        同伴出勤
                      </label>
                      <div className="flex justify-end">
                        <button
                          onClick={() => handleSaveAttendance(attendance.id)}
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
                <h3 className="text-lg font-semibold mb-3">勤怠の新規追加</h3>
                <form className="space-y-4" onSubmit={handleAddAttendance}>
                  <label className="flex flex-col gap-2 text-sm">
                    <span className="text-gray-300">スタッフ</span>
                    <select
                      value={newAttendanceForm.userEmail}
                      onChange={event =>
                        setNewAttendanceForm(prev => ({
                          ...prev,
                          userEmail: event.target.value
                        }))
                      }
                      className="bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white"
                    >
                      <option value="">選択してください</option>
                      {userRoles.map(user => (
                        <option key={user.email} value={user.email}>
                          {user.display_name}（{user.role}）
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="flex flex-col gap-2 text-sm">
                    <span className="text-gray-300">開始日時</span>
                    <input
                      type="datetime-local"
                      value={newAttendanceForm.startDateTime}
                      onChange={event =>
                        setNewAttendanceForm(prev => ({
                          ...prev,
                          startDateTime: event.target.value
                        }))
                      }
                      className="bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white"
                    />
                  </label>
                  <label className="flex flex-col gap-2 text-sm">
                    <span className="text-gray-300">終了日時（任意）</span>
                    <input
                      type="datetime-local"
                      value={newAttendanceForm.endDateTime}
                      onChange={event =>
                        setNewAttendanceForm(prev => ({
                          ...prev,
                          endDateTime: event.target.value
                        }))
                      }
                      className="bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white"
                    />
                  </label>
                  <label className="inline-flex items-center gap-2 text-sm text-gray-300">
                    <input
                      type="checkbox"
                      checked={newAttendanceForm.companion}
                      onChange={event =>
                        setNewAttendanceForm(prev => ({
                          ...prev,
                          companion: event.target.checked
                        }))
                      }
                      className="h-4 w-4 rounded border-gray-600 bg-gray-800"
                    />
                    同伴出勤
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

export default AttendanceCalendar
