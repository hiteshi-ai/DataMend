import React, { useState, useEffect } from 'react'
import { Settings, Save, Bell, Sparkles, CheckCircle2, ShieldCheck } from 'lucide-react'
import { adminApi } from '../../lib/api'

export const AdminSettingsPage: React.FC = () => {
  const [maxFileSize, setMaxFileSize] = useState(50)
  const [maxRows, setMaxRows] = useState(500000)
  const [allowSignup, setAllowSignup] = useState(true)
  const [supportEmail, setSupportEmail] = useState('support@datamend.internal')
  const [announcementTitle, setAnnouncementTitle] = useState('')
  const [announcementBody, setAnnouncementBody] = useState('')
  const [saving, setSaving] = useState(false)
  const [savedSuccess, setSavedSuccess] = useState(false)

  useEffect(() => {
    loadSettings()
  }, [])

  const loadSettings = async () => {
    try {
      const res = await adminApi.getSettings()
      const s = res.data || {}
      if (s.max_file_size_mb) setMaxFileSize(s.max_file_size_mb)
      if (s.max_rows) setMaxRows(s.max_rows)
      if (s.allow_public_signup !== undefined) setAllowSignup(s.allow_public_signup)
      if (s.support_email) setSupportEmail(s.support_email)
    } catch (err) {
      console.error(err)
    }
  }

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setSavedSuccess(false)
    try {
      await adminApi.updateSettings({
        max_file_size_mb: maxFileSize,
        max_rows: maxRows,
        allow_public_signup: allowSignup,
        support_email: supportEmail,
      })
      setSavedSuccess(true)
      setTimeout(() => setSavedSuccess(false), 3000)
    } catch (err) {
      alert('Failed to save settings.')
    } finally {
      setSaving(false)
    }
  }

  const handlePostAnnouncement = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!announcementTitle || !announcementBody) return
    try {
      await adminApi.createAnnouncement({
        title: announcementTitle,
        body: announcementBody,
        is_active: true,
      })
      alert('Announcement published successfully.')
      setAnnouncementTitle('')
      setAnnouncementBody('')
    } catch (err) {
      alert('Failed to publish announcement.')
    }
  }

  return (
    <div className="space-y-6 animate-fade-in text-[#F3F6FF]">
      <div className="pb-4 border-b border-[#2A3D6A]">
        <h1 className="text-xl font-bold tracking-tight text-white">System Configuration</h1>
        <p className="text-xs text-gray-400 mt-0.5">
          Tune resource quotas, upload limits, announcements, and AI provider behaviors.
        </p>
      </div>

      {savedSuccess && (
        <div className="p-3.5 rounded-xl bg-green-950/60 border border-green-800 text-green-300 text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4" />
          <span>System configuration updated and applied immediately.</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Core Parameters Form */}
        <form onSubmit={handleSaveSettings} className="p-6 rounded-2xl bg-[#162244] border border-[#2A3D6A] shadow-md space-y-4">
          <h3 className="font-bold text-sm text-white flex items-center gap-2">
            <Settings className="w-4 h-4 text-[#9AB7FF]" />
            <span>Processing & Ingestion Quotas</span>
          </h3>

          <div>
            <label className="block text-xs font-semibold mb-1 text-gray-300">Max File Upload Size (MB)</label>
            <input
              type="number"
              value={maxFileSize}
              onChange={(e) => setMaxFileSize(Number(e.target.value))}
              min={1}
              max={200}
              className="w-full px-3 py-2 rounded-xl bg-[#101B35] border border-[#2A3D6A] text-xs text-white focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold mb-1 text-gray-300">Max Row Ingestion Limit</label>
            <input
              type="number"
              value={maxRows}
              onChange={(e) => setMaxRows(Number(e.target.value))}
              min={1000}
              max={2000000}
              className="w-full px-3 py-2 rounded-xl bg-[#101B35] border border-[#2A3D6A] text-xs text-white focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold mb-1 text-gray-300">Support / Contact Email</label>
            <input
              type="email"
              value={supportEmail}
              onChange={(e) => setSupportEmail(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-[#101B35] border border-[#2A3D6A] text-xs text-white focus:outline-none"
            />
          </div>

          <div className="flex items-center gap-2 pt-2">
            <input
              type="checkbox"
              id="signupCheck"
              checked={allowSignup}
              onChange={(e) => setAllowSignup(e.target.checked)}
              className="rounded border-[#2A3D6A] text-[#9AB7FF]"
            />
            <label htmlFor="signupCheck" className="text-xs text-gray-300">
              Allow Public User Registration (Self-service signup)
            </label>
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2.5 rounded-xl bg-[#9AB7FF] text-[#101B35] font-bold text-xs hover:opacity-90 transition-all flex items-center gap-2 shadow-sm disabled:opacity-50"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{saving ? 'Saving...' : 'Save System Settings'}</span>
            </button>
          </div>
        </form>

        {/* Announcements Form */}
        <form onSubmit={handlePostAnnouncement} className="p-6 rounded-2xl bg-[#162244] border border-[#2A3D6A] shadow-md space-y-4">
          <h3 className="font-bold text-sm text-white flex items-center gap-2">
            <Bell className="w-4 h-4 text-[#9AB7FF]" />
            <span>Broadcast Platform Announcement</span>
          </h3>

          <div>
            <label className="block text-xs font-semibold mb-1 text-gray-300">Announcement Title</label>
            <input
              type="text"
              required
              value={announcementTitle}
              onChange={(e) => setAnnouncementTitle(e.target.value)}
              placeholder="e.g. Scheduled Maintenance or New Cleaning Feature"
              className="w-full px-3 py-2 rounded-xl bg-[#101B35] border border-[#2A3D6A] text-xs text-white focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold mb-1 text-gray-300">Body Content</label>
            <textarea
              required
              rows={4}
              value={announcementBody}
              onChange={(e) => setAnnouncementBody(e.target.value)}
              placeholder="Announcement details visible to all users..."
              className="w-full p-3 rounded-xl bg-[#101B35] border border-[#2A3D6A] text-xs text-white focus:outline-none"
            />
          </div>

          <button
            type="submit"
            className="px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs transition-all flex items-center gap-2 shadow-sm"
          >
            <Bell className="w-3.5 h-3.5" />
            <span>Broadcast to Users</span>
          </button>
        </form>
      </div>
    </div>
  )
}

