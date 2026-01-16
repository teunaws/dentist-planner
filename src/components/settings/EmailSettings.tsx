import { useState, useEffect, useRef } from 'react'
import { Mail, Copy, Eye, Save, MessageSquare, Edit2 } from 'lucide-react'
import { GlassCard } from '../ui/GlassCard'
import { GlassButton } from '../ui/GlassButton'
import { GlassInput } from '../ui/GlassInput'
import { notifications } from '../../lib/notifications'
import type { EmailConfig, SMSConfig } from '../../types/tenant'

interface EmailSettingsProps {
  emailConfig: EmailConfig
  smsConfig?: SMSConfig
  tenantName: string
  onSave: (emailConfig: EmailConfig, smsConfig?: SMSConfig, isAutoSave?: boolean) => Promise<void>
  isSaving?: boolean
}

const AVAILABLE_VARIABLES = [
  { var: '{{patient_name}}', description: "Patient's full name" },
  { var: '{{service_name}}', description: 'Service type (e.g., "Cleaning")' },
  { var: '{{date}}', description: 'Appointment date (e.g., "Monday, January 15, 2024")' },
  { var: '{{time}}', description: 'Appointment time (e.g., "10:00 AM")' },
  { var: '{{tenant_name}}', description: 'Practice name' },
  { var: '{{location}}', description: 'Practice address (if available)' },
]

const MOCK_DATA = {
  patient_name: 'John Doe',
  service_name: 'Dental Cleaning',
  date: 'Monday, January 15, 2024',
  time: '10:00 AM',
  tenant_name: 'Soho Smiles',
  location: '123 Main Street, New York, NY 10001',
}

export const EmailSettings = ({ emailConfig, smsConfig, tenantName, onSave, isSaving = false }: EmailSettingsProps) => {
  const [config, setConfig] = useState<EmailConfig>(emailConfig)
  const [smsCfg, setSmsCfg] = useState<SMSConfig>(smsConfig || {})
  
  // Edit states for each section
  const [isEditingSender, setIsEditingSender] = useState(false)
  const [isEditingConfirmation, setIsEditingConfirmation] = useState(false)
  const [isEditingReminder, setIsEditingReminder] = useState(false)
  const [isEditingSMS, setIsEditingSMS] = useState(false)
  // Loading state for auto-saving toggles
  const [isAutoSaving, setIsAutoSaving] = useState(false)
  // Validation errors for sender identity
  const [senderValidationErrors, setSenderValidationErrors] = useState<{
    senderName?: string
    senderLocalPart?: string
  }>({})

  // Track if this is the initial load to prevent auto-saving on mount
  const isInitialLoad = useRef(true)
  const saveTimeoutRef = useRef<number | null>(null)
  // Track if we're waiting for a save to complete (to prevent prop sync from overwriting user changes)
  const isSavingRef = useRef(false)
  // Track previous toggle values to detect actual user changes (not prop updates)
  const prevToggleValuesRef = useRef({
    confirmationEnabled: emailConfig.confirmationEnabled,
    reminderEnabled: emailConfig.reminderEnabled,
    smsConfirmationEnabled: smsConfig?.confirmationEnabled,
    smsReminderEnabled: smsConfig?.reminderEnabled,
  })
  // Use refs to get latest values in the timeout callback
  const configRef = useRef(config)
  const smsCfgRef = useRef(smsCfg)
  // Track last saved values to detect when save completes
  const lastSavedConfigRef = useRef<EmailConfig | null>(null)
  const lastSavedSmsCfgRef = useRef<SMSConfig | null>(null)

  useEffect(() => {
    // On initial load, always sync
    if (isInitialLoad.current) {
      // Normalize toggle values to explicit booleans (undefined -> true for backward compatibility)
      const normalizedConfig = {
        ...emailConfig,
        confirmationEnabled: emailConfig.confirmationEnabled !== false,
        reminderEnabled: emailConfig.reminderEnabled ?? false,
      }
      setConfig(normalizedConfig)
      configRef.current = normalizedConfig
      prevToggleValuesRef.current = {
        confirmationEnabled: normalizedConfig.confirmationEnabled,
        reminderEnabled: normalizedConfig.reminderEnabled,
        smsConfirmationEnabled: prevToggleValuesRef.current.smsConfirmationEnabled,
        smsReminderEnabled: prevToggleValuesRef.current.smsReminderEnabled,
      }
      isInitialLoad.current = false
      return
    }

    // After initial load: only sync if we're not saving AND not editing
    // Don't overwrite user's template edits while they're editing
    if (!isSavingRef.current && !isEditingConfirmation && !isEditingReminder && !isEditingSender) {
      const currentConfig = configRef.current
      
      // Check if props match what we just saved (save completed successfully)
      const propsMatchSaved = lastSavedConfigRef.current && 
        emailConfig.confirmationSubject === lastSavedConfigRef.current.confirmationSubject &&
        emailConfig.confirmationBody === lastSavedConfigRef.current.confirmationBody &&
        emailConfig.senderName === lastSavedConfigRef.current.senderName &&
        emailConfig.senderLocalPart === lastSavedConfigRef.current.senderLocalPart &&
        emailConfig.replyTo === lastSavedConfigRef.current.replyTo
      
      // Normalize toggle values from props
      const normalizedConfirmationEnabled = emailConfig.confirmationEnabled !== false
      const normalizedReminderEnabled = emailConfig.reminderEnabled ?? false
      
      // Only sync if props match what we saved (save succeeded) OR if we haven't saved yet
      if (propsMatchSaved || !lastSavedConfigRef.current) {
        // If props match saved, sync toggle values from props (they were successfully saved)
        // Otherwise, preserve local toggle values (they might be ahead of props)
        const shouldSyncToggles = propsMatchSaved || 
          (emailConfig.confirmationEnabled !== undefined && emailConfig.reminderEnabled !== undefined)
        
        setConfig(prev => ({
          ...emailConfig,
          confirmationEnabled: shouldSyncToggles ? normalizedConfirmationEnabled : prev.confirmationEnabled,
          reminderEnabled: shouldSyncToggles ? normalizedReminderEnabled : prev.reminderEnabled,
        }))
        configRef.current = {
          ...emailConfig,
          confirmationEnabled: shouldSyncToggles ? normalizedConfirmationEnabled : currentConfig.confirmationEnabled,
          reminderEnabled: shouldSyncToggles ? normalizedReminderEnabled : currentConfig.reminderEnabled,
        }
        
        // Update prevToggleValuesRef if we synced toggles
        if (shouldSyncToggles) {
          prevToggleValuesRef.current = {
            ...prevToggleValuesRef.current,
            confirmationEnabled: normalizedConfirmationEnabled,
            reminderEnabled: normalizedReminderEnabled,
          }
        }
        
        // Clear saved ref if props match (save completed)
        if (propsMatchSaved) {
          lastSavedConfigRef.current = null
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [emailConfig])

  useEffect(() => {
    // On initial load, always sync
    if (isInitialLoad.current) {
      // Normalize toggle values to explicit booleans
      const normalizedSmsCfg = {
        ...(smsConfig || {}),
        confirmationEnabled: smsConfig?.confirmationEnabled ?? false,
        reminderEnabled: smsConfig?.reminderEnabled ?? false,
      }
      setSmsCfg(normalizedSmsCfg)
      smsCfgRef.current = normalizedSmsCfg
      prevToggleValuesRef.current = {
        confirmationEnabled: prevToggleValuesRef.current.confirmationEnabled,
        reminderEnabled: prevToggleValuesRef.current.reminderEnabled,
        smsConfirmationEnabled: normalizedSmsCfg.confirmationEnabled,
        smsReminderEnabled: normalizedSmsCfg.reminderEnabled,
      }
      return
    }

    // After initial load: only sync if we're not saving AND not editing
    // Don't overwrite user's template edits while they're editing
    if (!isSavingRef.current && !isEditingSMS) {
      const currentSmsCfg = smsCfgRef.current
      
      // Check if props match what we just saved (save completed successfully)
      const propsMatchSaved = lastSavedSmsCfgRef.current && 
        (smsConfig?.confirmationTemplate || '') === (lastSavedSmsCfgRef.current.confirmationTemplate || '') &&
        (smsConfig?.reminderTemplate || '') === (lastSavedSmsCfgRef.current.reminderTemplate || '')
      
      // Normalize toggle values from props
      const normalizedSmsConfirmationEnabled = smsConfig?.confirmationEnabled ?? false
      const normalizedSmsReminderEnabled = smsConfig?.reminderEnabled ?? false
      
      // Only sync if props match what we saved (save succeeded) OR if we haven't saved yet
      if (propsMatchSaved || !lastSavedSmsCfgRef.current) {
        // If props match saved, sync toggle values from props (they were successfully saved)
        // Otherwise, preserve local toggle values (they might be ahead of props)
        const shouldSyncToggles = propsMatchSaved || 
          (smsConfig?.confirmationEnabled !== undefined && smsConfig?.reminderEnabled !== undefined)
        
        setSmsCfg(prev => ({
          ...(smsConfig || {}),
          confirmationEnabled: shouldSyncToggles ? normalizedSmsConfirmationEnabled : prev.confirmationEnabled,
          reminderEnabled: shouldSyncToggles ? normalizedSmsReminderEnabled : prev.reminderEnabled,
        }))
        smsCfgRef.current = {
          ...(smsConfig || {}),
          confirmationEnabled: shouldSyncToggles ? normalizedSmsConfirmationEnabled : currentSmsCfg.confirmationEnabled,
          reminderEnabled: shouldSyncToggles ? normalizedSmsReminderEnabled : currentSmsCfg.reminderEnabled,
        }
        
        // Update prevToggleValuesRef if we synced toggles
        if (shouldSyncToggles) {
          prevToggleValuesRef.current = {
            ...prevToggleValuesRef.current,
            smsConfirmationEnabled: normalizedSmsConfirmationEnabled,
            smsReminderEnabled: normalizedSmsReminderEnabled,
          }
        }
        
        // Clear saved ref if props match (save completed)
        if (propsMatchSaved) {
          lastSavedSmsCfgRef.current = null
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [smsConfig])

  // Keep refs in sync with state
  useEffect(() => {
    configRef.current = config
  }, [config])

  useEffect(() => {
    smsCfgRef.current = smsCfg
  }, [smsCfg])

  // Auto-save toggle changes (debounced) - similar to booking form fields
  useEffect(() => {
    // Skip auto-save on initial load
    if (isInitialLoad.current) {
      isInitialLoad.current = false
      // Update prev values after initial load
      prevToggleValuesRef.current = {
        confirmationEnabled: config.confirmationEnabled,
        reminderEnabled: config.reminderEnabled,
        smsConfirmationEnabled: smsCfg.confirmationEnabled,
        smsReminderEnabled: smsCfg.reminderEnabled,
      }
      return
    }

    // Check if toggle values actually changed (user interaction vs prop update)
    const currentToggleValues = {
      confirmationEnabled: config.confirmationEnabled,
      reminderEnabled: config.reminderEnabled,
      smsConfirmationEnabled: smsCfg.confirmationEnabled,
      smsReminderEnabled: smsCfg.reminderEnabled,
    }

    const hasChanged =
      prevToggleValuesRef.current.confirmationEnabled !== currentToggleValues.confirmationEnabled ||
      prevToggleValuesRef.current.reminderEnabled !== currentToggleValues.reminderEnabled ||
      prevToggleValuesRef.current.smsConfirmationEnabled !== currentToggleValues.smsConfirmationEnabled ||
      prevToggleValuesRef.current.smsReminderEnabled !== currentToggleValues.smsReminderEnabled

    // Only auto-save if values actually changed (user interaction)
    if (!hasChanged) {
      console.log('[EmailSettings] No toggle changes detected, skipping auto-save')
      return
    }

    console.log('[EmailSettings] Toggle changes detected, scheduling auto-save:', {
      prev: prevToggleValuesRef.current,
      current: currentToggleValues,
    })

    // Clear any existing timeout
    if (saveTimeoutRef.current !== null) {
      clearTimeout(saveTimeoutRef.current)
    }

    // Debounce: wait 500ms after last toggle change before saving
    saveTimeoutRef.current = window.setTimeout(async () => {
      // Wait for any ongoing save to complete before starting a new one
      // This ensures we save the latest state even if toggles changed during a save
      while (isSavingRef.current) {
        await new Promise(resolve => setTimeout(resolve, 100))
      }
      
      // Use refs to get latest values (these might have changed while waiting)
      // Re-check if values still differ from previous (user might have changed them back)
      const latestConfig = configRef.current
      const latestSmsCfg = smsCfgRef.current
      
      // Normalize toggle values to explicit booleans
      const latestToggleValues = {
        confirmationEnabled: latestConfig.confirmationEnabled !== false,
        reminderEnabled: latestConfig.reminderEnabled ?? false,
        smsConfirmationEnabled: latestSmsCfg.confirmationEnabled ?? false,
        smsReminderEnabled: latestSmsCfg.reminderEnabled ?? false,
      }
      
      // Check if values still differ from what we last saved
      const stillHasChanges =
        prevToggleValuesRef.current.confirmationEnabled !== latestToggleValues.confirmationEnabled ||
        prevToggleValuesRef.current.reminderEnabled !== latestToggleValues.reminderEnabled ||
        prevToggleValuesRef.current.smsConfirmationEnabled !== latestToggleValues.smsConfirmationEnabled ||
        prevToggleValuesRef.current.smsReminderEnabled !== latestToggleValues.smsReminderEnabled
      
      if (!stillHasChanges) {
        // Values were reverted or already saved, skip
        console.log('[EmailSettings] No changes detected, skipping save')
        return
      }
      
      // Create normalized config objects with explicit boolean values
      // Always include toggle values explicitly, even if false
      const normalizedConfig: EmailConfig = {
        senderName: latestConfig.senderName,
        senderLocalPart: latestConfig.senderLocalPart,
        replyTo: latestConfig.replyTo,
        confirmationEnabled: latestToggleValues.confirmationEnabled,
        confirmationSubject: latestConfig.confirmationSubject,
        confirmationBody: latestConfig.confirmationBody,
        reminderEnabled: latestToggleValues.reminderEnabled,
        reminderSubject: latestConfig.reminderSubject,
        reminderBody: latestConfig.reminderBody,
      }
      const normalizedSmsCfg: SMSConfig = {
        confirmationEnabled: latestToggleValues.smsConfirmationEnabled,
        confirmationTemplate: latestSmsCfg.confirmationTemplate,
        reminderEnabled: latestToggleValues.smsReminderEnabled,
        reminderTemplate: latestSmsCfg.reminderTemplate,
      }
      
      console.log('[EmailSettings] Auto-saving toggle changes:', { 
        config: normalizedConfig, 
        smsCfg: normalizedSmsCfg,
        confirmationEnabled: normalizedConfig.confirmationEnabled,
        reminderEnabled: normalizedConfig.reminderEnabled,
      })
      console.log('[EmailSettings] Normalized config keys:', Object.keys(normalizedConfig))
      console.log('[EmailSettings] confirmationEnabled in config?', 'confirmationEnabled' in normalizedConfig)
      console.log('[EmailSettings] reminderEnabled in config?', 'reminderEnabled' in normalizedConfig)
      console.log('[EmailSettings] Full normalized config JSON:', JSON.stringify(normalizedConfig, null, 2))
      
      // Set saving flag to prevent prop sync from overwriting user changes
      isSavingRef.current = true
      setIsAutoSaving(true)
      
      try {
        await onSave(normalizedConfig, normalizedSmsCfg, true) // Pass isAutoSave: true
        console.log('[EmailSettings] Toggle changes auto-saved successfully')
        // Update prev values AFTER successful save (so we don't save again)
        prevToggleValuesRef.current = latestToggleValues
      } catch (err) {
        console.error('[EmailSettings] Error auto-saving toggle changes:', err)
        // Silently fail - don't show error to user for background saves
        // Don't update prevToggleValuesRef on error, so it will retry on next change
      } finally {
        setIsAutoSaving(false)
        // Clear saving flag after a delay to allow props to update from save
        setTimeout(() => {
          isSavingRef.current = false
        }, 300)
      }
    }, 500) // 500ms debounce

    // Cleanup timeout on unmount
    return () => {
      if (saveTimeoutRef.current !== null) {
        clearTimeout(saveTimeoutRef.current)
      }
    }
  }, [config.confirmationEnabled, config.reminderEnabled, smsCfg.confirmationEnabled, smsCfg.reminderEnabled, onSave])

  const handleCopyVariable = (variable: string) => {
    navigator.clipboard.writeText(variable)
  }

  const replaceVariables = (text: string): string => {
    let result = text
    Object.entries(MOCK_DATA).forEach(([key, value]) => {
      result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value)
    })
    return result
  }

  const handleSave = async () => {
    console.log('[EmailSettings] Manual save triggered')
    
    // Wait for any ongoing auto-save to complete first
    while (isSavingRef.current) {
      console.log('[EmailSettings] Waiting for ongoing save to complete...')
      await new Promise(resolve => setTimeout(resolve, 100))
    }
    
    // Get latest values (might have changed while waiting)
    const latestConfig = configRef.current
    const latestSmsCfg = smsCfgRef.current
    
    // Normalize toggle values to explicit booleans
    // Always include toggle values explicitly, even if false
    const normalizedConfig: EmailConfig = {
      senderName: latestConfig.senderName,
      senderLocalPart: latestConfig.senderLocalPart,
      replyTo: latestConfig.replyTo,
      confirmationEnabled: latestConfig.confirmationEnabled !== false,
      confirmationSubject: latestConfig.confirmationSubject,
      confirmationBody: latestConfig.confirmationBody,
      reminderEnabled: latestConfig.reminderEnabled ?? false,
      reminderSubject: latestConfig.reminderSubject,
      reminderBody: latestConfig.reminderBody,
    }
    const normalizedSmsCfg: SMSConfig = {
      confirmationEnabled: latestSmsCfg.confirmationEnabled ?? false,
      confirmationTemplate: latestSmsCfg.confirmationTemplate,
      reminderEnabled: latestSmsCfg.reminderEnabled ?? false,
      reminderTemplate: latestSmsCfg.reminderTemplate,
    }
    
    console.log('[EmailSettings] Saving config:', { config: normalizedConfig, smsCfg: normalizedSmsCfg })
    
    // Track what we're saving
    lastSavedConfigRef.current = { ...normalizedConfig }
    lastSavedSmsCfgRef.current = { ...normalizedSmsCfg }
    
    // Set saving flag to prevent prop sync during save
    isSavingRef.current = true
    
    try {
      await onSave(normalizedConfig, normalizedSmsCfg, false) // Pass isAutoSave: false for manual saves
      console.log('[EmailSettings] Manual save completed successfully')
      
      // After save completes, wait a bit for props to update, then sync
      setTimeout(() => {
        isSavingRef.current = false
        // Force sync from props after save (they should now have the saved values)
        if (emailConfig) {
          setConfig(emailConfig)
          configRef.current = emailConfig
        }
        if (smsConfig) {
          setSmsCfg(smsConfig)
          smsCfgRef.current = smsConfig
        }
      }, 500)
    } catch (error) {
      console.error('[EmailSettings] Manual save failed:', error)
      isSavingRef.current = false
      lastSavedConfigRef.current = null
      lastSavedSmsCfgRef.current = null
      throw error
    }
    
    // Note: Individual save handlers will exit their specific edit modes
  }

  const handleSaveSender = async () => {
    // Validate required fields
    const errors: {
      senderName?: string
      senderLocalPart?: string
    } = {}
    
    if (!config.senderName || config.senderName.trim() === '') {
      errors.senderName = 'Sender Name cannot be empty'
    }
    
    if (!config.senderLocalPart || config.senderLocalPart.trim() === '') {
      errors.senderLocalPart = 'Email Address Prefix cannot be empty'
    }
    
    // If there are validation errors, show them and prevent saving
    if (Object.keys(errors).length > 0) {
      setSenderValidationErrors(errors)
      const errorMessages = Object.values(errors)
      notifications.error('Validation Error', errorMessages.join('. '))
      console.log('[EmailSettings] Validation failed:', errors)
      return
    }
    
    // Clear validation errors
    setSenderValidationErrors({})
    
    // All validations passed, proceed with save
    await handleSave()
    setIsEditingSender(false)
  }

  const handleSaveConfirmation = async () => {
    await handleSave()
    setIsEditingConfirmation(false)
  }

  const handleSaveReminder = async () => {
    await handleSave()
    setIsEditingReminder(false)
  }

  const handleSaveSMS = async () => {
    await handleSave()
    setIsEditingSMS(false)
  }


  return (
    <div className="space-y-6">
      {/* Sender Identity Card */}
      <GlassCard className="rounded-3xl p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Mail className="h-5 w-5 text-slate-600" />
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Sender Identity</h2>
              <p className="text-xs text-slate-500">Configure how your emails appear to patients</p>
            </div>
          </div>
          {!isEditingSender && (
            <GlassButton
              variant="secondary"
              size="sm"
              onClick={() => {
                setIsEditingSender(true)
                // Clear any previous validation errors when entering edit mode
                setSenderValidationErrors({})
              }}
            >
              <Edit2 className="mr-2 h-4 w-4" />
              Edit
            </GlassButton>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <GlassInput
            label="Sender Name"
            value={isEditingSender ? (config.senderName ?? '') : (config.senderName || tenantName)}
            onChange={(e) => {
              setConfig({ ...config, senderName: e.target.value })
              // Clear error when user starts typing
              if (senderValidationErrors.senderName) {
                setSenderValidationErrors(prev => ({ ...prev, senderName: undefined }))
              }
            }}
            placeholder={tenantName}
            helperText="Display name in the 'From' field (e.g., 'Soho Smiles'). For SMS: max 11 characters (spaces removed)."
            maxLength={20}
            disabled={!isEditingSender}
            error={senderValidationErrors.senderName}
          />

          <GlassInput
            label="Email Address Prefix"
            value={isEditingSender ? (config.senderLocalPart ?? '') : (config.senderLocalPart || 'bookings')}
            onChange={(e) => {
              setConfig({ ...config, senderLocalPart: e.target.value })
              // Clear error when user starts typing
              if (senderValidationErrors.senderLocalPart) {
                setSenderValidationErrors(prev => ({ ...prev, senderLocalPart: undefined }))
              }
            }}
            placeholder="bookings"
            helperText="The part before @your-domain.com (e.g., 'bookings' for bookings@domain.com)"
            disabled={!isEditingSender}
            error={senderValidationErrors.senderLocalPart}
          />

          <div className="md:col-span-2">
            <GlassInput
              label="Reply-To Email"
              type="email"
              value={config.replyTo || ''}
              onChange={(e) => setConfig({ ...config, replyTo: e.target.value })}
              placeholder="office@practice.com"
              helperText="Where patient replies will be sent (optional)"
              disabled={!isEditingSender}
            />
          </div>
        </div>

        {isEditingSender && (
          <div className="flex justify-end pt-4 border-t border-slate-200">
            <GlassButton 
              onClick={async (e) => {
                e.preventDefault()
                e.stopPropagation()
                console.log('[EmailSettings] Save Sender Identity button clicked')
                await handleSaveSender()
              }} 
              isLoading={isSaving}
            >
              <Save className="mr-2 h-4 w-4" />
              Save Sender Identity
            </GlassButton>
          </div>
        )}
      </GlassCard>

      {/* Email Configuration Card */}
      <GlassCard className="rounded-3xl p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Mail className="h-5 w-5 text-slate-600" />
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Email Configuration</h2>
              <p className="text-xs text-slate-500">Enable and customize email notifications for patients</p>
            </div>
          </div>
          {isAutoSaving && (
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <div className="h-3 w-3 animate-spin rounded-full border-2 border-slate-400 border-t-transparent"></div>
              <span>Saving...</span>
            </div>
          )}
        </div>

        {/* Email Confirmation Toggle */}
        <div className="space-y-4">
          <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg border border-slate-200">
            <div className="flex-1">
              <label className="text-sm font-medium text-slate-900 block mb-1">
                Send Email Confirmation
              </label>
              <p className="text-xs text-slate-500">
                Send an email when a patient books an appointment
              </p>
            </div>
            <div className="flex items-center gap-2">
              {(config.confirmationEnabled !== false) && !isEditingConfirmation && (
                <GlassButton
                  variant="secondary"
                  size="sm"
                  onClick={() => setIsEditingConfirmation(true)}
                >
                  <Edit2 className="mr-2 h-4 w-4" />
                  Edit Template
                </GlassButton>
              )}
              <button
                type="button"
                onClick={() => {
                  // Use explicit boolean - default to true if undefined (backward compatibility)
                  const currentValue = config.confirmationEnabled !== false
                  const newValue = !currentValue
                  console.log('[EmailSettings] Toggling email confirmation:', { currentValue, newValue })
                  setConfig({ ...config, confirmationEnabled: newValue })
                  // Exit edit mode if toggle is turned off
                  if (!newValue) {
                    setIsEditingConfirmation(false)
                  }
                }}
                className={`relative w-12 h-6 rounded-full transition-colors ${
                  config.confirmationEnabled !== false ? 'bg-slate-900' : 'bg-slate-300'
                }`}
              >
                <span
                  className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform ${
                    config.confirmationEnabled !== false ? 'translate-x-6' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
          </div>

          {/* Email Confirmation Template (shown when enabled) */}
          {(config.confirmationEnabled !== false) && (
            <div className="space-y-3 pl-4 border-l-2 border-slate-200">
              {/* Variable Legend */}
              <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
                <p className="text-xs font-semibold text-slate-700 mb-2">Available Variables (click to copy):</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {AVAILABLE_VARIABLES.map((item) => (
                    <button
                      key={item.var}
                      onClick={() => handleCopyVariable(item.var)}
                      className="flex items-center gap-2 text-left text-xs text-slate-600 hover:text-slate-900 hover:bg-white rounded px-2 py-1 transition-colors"
                    >
                      <code className="bg-white px-2 py-0.5 rounded border border-slate-200 font-mono text-slate-900">
                        {item.var}
                      </code>
                      <span className="text-slate-500">{item.description}</span>
                      <Copy className="h-3 w-3 ml-auto text-slate-400" />
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Editor Column */}
                <div className="space-y-4">
                  <div>
                    <label className="text-xs font-medium text-slate-700 mb-1 block">
                      Subject Line
                    </label>
                    <input
                      type="text"
                      value={config.confirmationSubject || 'Appointment Confirmed: {{date}}'}
                      onChange={(e) => setConfig({ ...config, confirmationSubject: e.target.value })}
                      disabled={!isEditingConfirmation}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent disabled:bg-slate-50 disabled:text-slate-500 disabled:cursor-not-allowed"
                      placeholder="Appointment Confirmed: {{date}}"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-medium text-slate-700 mb-1 block">
                      Email Body
                    </label>
                    <textarea
                      value={config.confirmationBody || ''}
                      onChange={(e) => setConfig({ ...config, confirmationBody: e.target.value })}
                      disabled={!isEditingConfirmation}
                      rows={12}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent resize-none font-mono disabled:bg-slate-50 disabled:text-slate-500 disabled:cursor-not-allowed"
                      placeholder="Hi {{patient_name}},&#10;&#10;Your appointment for {{service_name}} is confirmed for {{time}} on {{date}}.&#10;&#10;We look forward to seeing you!"
                    />
                    <p className="text-xs text-slate-500 mt-1">
                      Use variables like {`{{patient_name}}`} to personalize your emails. Line breaks are preserved.
                    </p>
                  </div>
                </div>

                {/* Preview Column */}
                <div className="space-y-4">
                  <label className="text-xs font-medium text-slate-700 mb-1 block">
                    Email Preview
                  </label>
                  <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-sm">
                    <div className="mb-4 pb-4 border-b border-slate-200">
                      <div className="text-xs text-slate-500 mb-1">From:</div>
                      <div className="text-sm font-medium text-slate-900">
                        {config.senderName || tenantName} &lt;{config.senderLocalPart || 'bookings'}@your-domain.com&gt;
                      </div>
                      {config.replyTo && (
                        <>
                          <div className="text-xs text-slate-500 mb-1 mt-2">Reply-To:</div>
                          <div className="text-sm text-slate-700">{config.replyTo}</div>
                        </>
                      )}
                      <div className="text-xs text-slate-500 mb-1 mt-2">Subject:</div>
                      <div className="text-sm font-semibold text-slate-900">
                        {replaceVariables(config.confirmationSubject || 'Appointment Confirmed: {{date}}')}
                      </div>
                    </div>

                    <div className="prose prose-sm max-w-none">
                      <div
                        className="text-sm text-slate-700 whitespace-pre-wrap"
                        dangerouslySetInnerHTML={{
                          __html: replaceVariables(config.confirmationBody || 'Hi {{patient_name}},\n\nYour appointment for {{service_name}} is confirmed for {{time}} on {{date}}.\n\nWe look forward to seeing you!')
                            .replace(/\n/g, '<br />')
                        }}
                      />
                    </div>

                    {/* Appointment Summary Box */}
                    <div className="mt-4 p-3 bg-slate-50 rounded-lg border border-slate-200">
                      <p className="text-xs font-semibold text-slate-700 mb-2">Appointment Details:</p>
                      <div className="space-y-1 text-xs text-slate-600">
                        <div><strong>Service:</strong> {MOCK_DATA.service_name}</div>
                        <div><strong>Date:</strong> {MOCK_DATA.date}</div>
                        <div><strong>Time:</strong> {MOCK_DATA.time}</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {isEditingConfirmation && (
                <div className="flex justify-end pt-4 border-t border-slate-200">
                  <GlassButton 
                    onClick={async (e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      console.log('[EmailSettings] Save Email Confirmation button clicked')
                      await handleSaveConfirmation()
                    }} 
                    isLoading={isSaving}
                  >
                    <Save className="mr-2 h-4 w-4" />
                    Save Confirmation Template
                  </GlassButton>
                </div>
              )}
            </div>
          )}

          {/* Email Reminder Toggle */}
          <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg border border-slate-200">
            <div className="flex-1">
              <label className="text-sm font-medium text-slate-900 block mb-1">
                Send Email Reminder (24h before)
              </label>
              <p className="text-xs text-slate-500">
                Automatically send email reminders 24 hours before appointments
              </p>
            </div>
            <div className="flex items-center gap-2">
              {(config.reminderEnabled ?? false) && !isEditingReminder && (
                <GlassButton
                  variant="secondary"
                  size="sm"
                  onClick={() => setIsEditingReminder(true)}
                >
                  <Edit2 className="mr-2 h-4 w-4" />
                  Edit Template
                </GlassButton>
              )}
              <button
                type="button"
                onClick={() => {
                  // Use explicit boolean - default to false if undefined
                  const currentValue = config.reminderEnabled ?? false
                  const newValue = !currentValue
                  console.log('[EmailSettings] Toggling email reminder:', { currentValue, newValue })
                  setConfig({ ...config, reminderEnabled: newValue })
                  // Exit edit mode if toggle is turned off
                  if (!newValue) {
                    setIsEditingReminder(false)
                  }
                }}
                className={`relative w-12 h-6 rounded-full transition-colors ${
                  (config.reminderEnabled ?? false) ? 'bg-slate-900' : 'bg-slate-300'
                }`}
              >
                <span
                  className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform ${
                    (config.reminderEnabled ?? false) ? 'translate-x-6' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
          </div>

          {/* Email Reminder Template (shown when enabled) */}
          {(config.reminderEnabled ?? false) && (
            <div className="space-y-3 pl-4 border-l-2 border-slate-200">
              {/* Variable Legend */}
              <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
                <p className="text-xs font-semibold text-slate-700 mb-2">Available Variables (click to copy):</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {AVAILABLE_VARIABLES.map((item) => (
                    <button
                      key={item.var}
                      onClick={() => handleCopyVariable(item.var)}
                      className="flex items-center gap-2 text-left text-xs text-slate-600 hover:text-slate-900 hover:bg-white rounded px-2 py-1 transition-colors"
                    >
                      <code className="bg-white px-2 py-0.5 rounded border border-slate-200 font-mono text-slate-900">
                        {item.var}
                      </code>
                      <span className="text-slate-500">{item.description}</span>
                      <Copy className="h-3 w-3 ml-auto text-slate-400" />
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Editor Column */}
                <div className="space-y-4">
                  <div>
                    <label className="text-xs font-medium text-slate-700 mb-1 block">
                      Subject Line
                    </label>
                    <input
                      type="text"
                      value={config.reminderSubject || ''}
                      onChange={(e) => setConfig({ ...config, reminderSubject: e.target.value })}
                      disabled={!isEditingReminder}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent disabled:bg-slate-50 disabled:text-slate-500 disabled:cursor-not-allowed"
                      placeholder="Reminder: Your appointment tomorrow at {{time}}"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-medium text-slate-700 mb-1 block">
                      Email Body
                    </label>
                    <textarea
                      value={config.reminderBody || ''}
                      onChange={(e) => setConfig({ ...config, reminderBody: e.target.value })}
                      disabled={!isEditingReminder}
                      rows={12}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent resize-none font-mono disabled:bg-slate-50 disabled:text-slate-500 disabled:cursor-not-allowed"
                      placeholder="Hi {{patient_name}},&#10;&#10;This is a reminder that you have an appointment for {{service_name}} tomorrow at {{time}}.&#10;&#10;We look forward to seeing you!"
                    />
                    <p className="text-xs text-slate-500 mt-1">
                      Use variables like {`{{patient_name}}`} to personalize your emails. Line breaks are preserved.
                    </p>
                  </div>
                </div>

                {/* Preview Column */}
                <div className="space-y-4">
                  <label className="text-xs font-medium text-slate-700 mb-1 block">
                    Email Preview
                  </label>
                  <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-sm">
                    <div className="mb-4 pb-4 border-b border-slate-200">
                      <div className="text-xs text-slate-500 mb-1">From:</div>
                      <div className="text-sm font-medium text-slate-900">
                        {config.senderName || tenantName} &lt;{config.senderLocalPart || 'bookings'}@your-domain.com&gt;
                      </div>
                      {config.replyTo && (
                        <>
                          <div className="text-xs text-slate-500 mb-1 mt-2">Reply-To:</div>
                          <div className="text-sm text-slate-700">{config.replyTo}</div>
                        </>
                      )}
                      <div className="text-xs text-slate-500 mb-1 mt-2">Subject:</div>
                      <div className="text-sm font-semibold text-slate-900">
                        {replaceVariables(config.reminderSubject || 'Reminder: Your appointment tomorrow at {{time}}')}
                      </div>
                    </div>

                    <div className="prose prose-sm max-w-none">
                      <div
                        className="text-sm text-slate-700 whitespace-pre-wrap"
                        dangerouslySetInnerHTML={{
                          __html: replaceVariables(config.reminderBody || 'Hi {{patient_name}},\n\nThis is a reminder that you have an appointment for {{service_name}} tomorrow at {{time}}.\n\nWe look forward to seeing you!')
                            .replace(/\n/g, '<br />')
                        }}
                      />
                    </div>

                    {/* Appointment Summary Box */}
                    <div className="mt-4 p-3 bg-slate-50 rounded-lg border border-slate-200">
                      <p className="text-xs font-semibold text-slate-700 mb-2">Appointment Details:</p>
                      <div className="space-y-1 text-xs text-slate-600">
                        <div><strong>Service:</strong> {MOCK_DATA.service_name}</div>
                        <div><strong>Date:</strong> {MOCK_DATA.date}</div>
                        <div><strong>Time:</strong> {MOCK_DATA.time}</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {isEditingReminder && (
                <div className="flex justify-end pt-4 border-t border-slate-200">
                  <GlassButton 
                    onClick={async (e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      console.log('[EmailSettings] Save Email Reminder button clicked')
                      await handleSaveReminder()
                    }} 
                    isLoading={isSaving}
                  >
                    <Save className="mr-2 h-4 w-4" />
                    Save Reminder Template
                  </GlassButton>
                </div>
              )}
            </div>
          )}
        </div>
      </GlassCard>

      {/* SMS Configuration Card */}
      <GlassCard className="rounded-3xl p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-slate-600" />
            <div>
              <h2 className="text-lg font-semibold text-slate-900">SMS Configuration</h2>
              <p className="text-xs text-slate-500">Enable and customize SMS notifications for patients</p>
            </div>
          </div>
          {isAutoSaving && (
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <div className="h-3 w-3 animate-spin rounded-full border-2 border-slate-400 border-t-transparent"></div>
              <span>Saving...</span>
            </div>
          )}
        </div>

        {/* SMS Confirmation Toggle */}
        <div className="space-y-4">
          <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg border border-slate-200">
            <div className="flex-1">
              <label className="text-sm font-medium text-slate-900 block mb-1">
                Send SMS Confirmation
              </label>
              <p className="text-xs text-slate-500">
                Send an SMS when a patient books an appointment
              </p>
            </div>
            <div className="flex items-center gap-2">
              {(smsCfg.confirmationEnabled ?? false) && !isEditingSMS && (
                <GlassButton
                  variant="secondary"
                  size="sm"
                  onClick={() => setIsEditingSMS(true)}
                >
                  <Edit2 className="mr-2 h-4 w-4" />
                  Edit Template
                </GlassButton>
              )}
              <button
                type="button"
                onClick={() => {
                  // Use explicit boolean - default to false if undefined
                  const currentValue = smsCfg.confirmationEnabled ?? false
                  const newValue = !currentValue
                  console.log('[EmailSettings] Toggling SMS confirmation:', { currentValue, newValue })
                  setSmsCfg({ ...smsCfg, confirmationEnabled: newValue })
                  // Exit edit mode if toggle is turned off
                  if (!newValue) {
                    setIsEditingSMS(false)
                  }
                }}
                className={`relative w-12 h-6 rounded-full transition-colors ${
                  (smsCfg.confirmationEnabled ?? false) ? 'bg-slate-900' : 'bg-slate-300'
                }`}
              >
                <span
                  className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform ${
                    (smsCfg.confirmationEnabled ?? false) ? 'translate-x-6' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
          </div>

          {/* SMS Confirmation Template (shown when enabled) */}
          {(smsCfg.confirmationEnabled ?? false) && (
            <div className="space-y-3 pl-4 border-l-2 border-slate-200">
              <div>
                <label className="text-xs font-medium text-slate-700 mb-1 block">
                  Confirmation Message Template
                </label>
                <textarea
                  value={smsCfg.confirmationTemplate || 'Hi {{patient_name}}, your appointment at {{tenant_name}} is confirmed for {{date}} at {{time}}.'}
                  onChange={(e) => setSmsCfg({ ...smsCfg, confirmationTemplate: e.target.value })}
                  disabled={!isEditingSMS}
                  rows={3}
                  maxLength={320}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent resize-none font-mono disabled:bg-slate-50 disabled:text-slate-500 disabled:cursor-not-allowed"
                  placeholder="Hi {{patient_name}}, your appointment at {{tenant_name}} is confirmed for {{date}} at {{time}}."
                />
                <div className="flex items-center justify-between mt-1">
                  <p className="text-xs text-slate-500">
                    Use variables like {`{{patient_name}}`} to personalize messages.
                  </p>
                  <span className={`text-xs font-medium ${
                    (smsCfg.confirmationTemplate || '').length > 160 ? 'text-rose-500' : 'text-slate-500'
                  }`}>
                    {(smsCfg.confirmationTemplate || '').length} / 160 characters
                  </span>
                </div>
                {(smsCfg.confirmationTemplate || '').length > 160 && (
                  <p className="text-xs text-rose-600 mt-1">
                    ⚠️ Message exceeds 160 characters and will be split into multiple segments
                  </p>
                )}
              </div>
            </div>
          )}

          {/* SMS Reminder Toggle */}
          <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg border border-slate-200">
            <div className="flex-1">
              <label className="text-sm font-medium text-slate-900 block mb-1">
                Send SMS Reminder (24h before)
              </label>
              <p className="text-xs text-slate-500">
                Automatically send SMS reminders 24 hours before appointments
              </p>
            </div>
            <div className="flex items-center gap-2">
              {(smsCfg.reminderEnabled ?? false) && !isEditingSMS && (
                <GlassButton
                  variant="secondary"
                  size="sm"
                  onClick={() => setIsEditingSMS(true)}
                >
                  <Edit2 className="mr-2 h-4 w-4" />
                  Edit Template
                </GlassButton>
              )}
              <button
                type="button"
                onClick={() => {
                  // Use explicit boolean - default to false if undefined
                  const currentValue = smsCfg.reminderEnabled ?? false
                  const newValue = !currentValue
                  console.log('[EmailSettings] Toggling SMS reminder:', { currentValue, newValue })
                  setSmsCfg({ ...smsCfg, reminderEnabled: newValue })
                  // Exit edit mode if toggle is turned off
                  if (!newValue) {
                    setIsEditingSMS(false)
                  }
                }}
                className={`relative w-12 h-6 rounded-full transition-colors ${
                  (smsCfg.reminderEnabled ?? false) ? 'bg-slate-900' : 'bg-slate-300'
                }`}
              >
                <span
                  className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform ${
                    (smsCfg.reminderEnabled ?? false) ? 'translate-x-6' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
          </div>

          {/* SMS Reminder Template (shown when enabled) */}
          {(smsCfg.reminderEnabled ?? false) && (
            <div className="space-y-3 pl-4 border-l-2 border-slate-200">
              <div>
                <label className="text-xs font-medium text-slate-700 mb-1 block">
                  Reminder Message Template
                </label>
                <textarea
                  value={smsCfg.reminderTemplate || 'Reminder: Appointment at {{tenant_name}} tomorrow at {{time}}'}
                  onChange={(e) => setSmsCfg({ ...smsCfg, reminderTemplate: e.target.value })}
                  disabled={!isEditingSMS}
                  rows={3}
                  maxLength={320}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent resize-none font-mono disabled:bg-slate-50 disabled:text-slate-500 disabled:cursor-not-allowed"
                  placeholder="Reminder: Appointment at {{tenant_name}} tomorrow at {{time}}"
                />
                <div className="flex items-center justify-between mt-1">
                  <p className="text-xs text-slate-500">
                    Use variables like {`{{patient_name}}`} to personalize messages.
                  </p>
                  <span className={`text-xs font-medium ${
                    (smsCfg.reminderTemplate || '').length > 160 ? 'text-rose-500' : 'text-slate-500'
                  }`}>
                    {(smsCfg.reminderTemplate || '').length} / 160 characters
                  </span>
                </div>
                {(smsCfg.reminderTemplate || '').length > 160 && (
                  <p className="text-xs text-rose-600 mt-1">
                    ⚠️ Message exceeds 160 characters and will be split into multiple segments
                  </p>
                )}
              </div>
            </div>
          )}
        </div>

        {isEditingSMS && (
          <div className="flex justify-end pt-4 border-t border-slate-200">
            <GlassButton 
              onClick={async (e) => {
                e.preventDefault()
                e.stopPropagation()
                console.log('[EmailSettings] Save SMS Configuration button clicked')
                await handleSaveSMS()
              }} 
              isLoading={isSaving}
            >
              <Save className="mr-2 h-4 w-4" />
              Save SMS Configuration
            </GlassButton>
          </div>
        )}
      </GlassCard>
    </div>
  )
}

