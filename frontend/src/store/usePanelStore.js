import { create } from 'zustand'

function loadCalendarOverrides() {
  try {
    return JSON.parse(localStorage.getItem('dashboard_calendar_settings') || 'null')
  } catch {
    return null
  }
}

/**
 * @typedef {Object} PanelState
 * @property {string} panel_id
 * @property {'on'|'off'|'dimmed'} display_state
 * @property {string} current_view
 * @property {string} previous_view
 * @property {'kids'|'adult'} mode
 * @property {string|null} adult_session_expires_at
 * @property {boolean} blanking_suppressed
 * @property {string|null} blanking_suppressed_until
 * @property {boolean} wake_on_motion
 * @property {boolean} wake_on_outdoor_motion
 * @property {Object|null} active_override
 * @property {number} default_blanking_suppression_seconds
 * @property {number} display_timeout_seconds
 * @property {boolean} quick_menu_open
 * @property {boolean} pin_pad_visible
 * @property {boolean} keyboard_visible
 * @property {'connecting'|'connected'|'disconnected'|'error'} mqtt_status
 * @property {Object|null} config
 */

const usePanelStore = create((set, get) => ({
  panel_id: 'kitchen',
  display_state: 'on',
  current_view: 'main_menu',
  previous_view: 'main_menu',
  mode: 'kids',
  adult_session_expires_at: null,
  blanking_suppressed: false,
  blanking_suppressed_until: null,
  wake_on_motion: true,
  wake_on_outdoor_motion: true,
  active_override: null,
  default_blanking_suppression_seconds: 14400,
  display_timeout_seconds: 180,
  quick_menu_open: false,
  pin_pad_visible: false,
  pin_last_result: null,
  keyboard_visible: false,
  mqtt_status: 'disconnected',
  config: null,

  // Calendar
  calendar_events: [],
  calendar_profile: null,
  calendar_overrides: loadCalendarOverrides(),

  setConfig: (config) => set({
    config,
    panel_id: config.panel_id,
    default_blanking_suppression_seconds: config.display.default_blanking_suppression_seconds,
    display_timeout_seconds: config.display.timeout_seconds,
  }),

  setMqttStatus: (mqtt_status) => set({ mqtt_status }),

  applyServerState: (serverState) => set((state) => ({
    ...state,
    ...serverState,
  })),

  setDisplayState: (display_state) => set({ display_state }),

  setCurrentView: (current_view) => set((state) => ({
    previous_view: state.current_view,
    current_view,
  })),

  setMode: (mode) => set({ mode }),

  setAdultSession: (expires_at) => set({
    mode: 'adult',
    adult_session_expires_at: expires_at,
  }),

  clearAdultSession: () => set({
    mode: 'kids',
    adult_session_expires_at: null,
  }),

  setBlankingSuppressed: (suppressed, until = null) => set({
    blanking_suppressed: suppressed,
    blanking_suppressed_until: until,
  }),

  setWakeOnMotion: (enabled) => set({ wake_on_motion: enabled }),

  setWakeOnOutdoorMotion: (enabled) => set({ wake_on_outdoor_motion: enabled }),

  setActiveOverride: (override) => set({ active_override: override }),

  clearActiveOverride: () => set({ active_override: null }),

  openQuickMenu: () => set({ quick_menu_open: true }),

  closeQuickMenu: () => set({ quick_menu_open: false }),

  showPinPad: () => set({ pin_pad_visible: true, pin_last_result: null }),

  hidePinPad: () => set({ pin_pad_visible: false, pin_last_result: null }),

  setPinResult: (result) => set({ pin_last_result: result }),

  showKeyboard: () => set({ keyboard_visible: true }),

  hideKeyboard: () => set({ keyboard_visible: false }),

  toggleKeyboard: () => set((state) => ({ keyboard_visible: !state.keyboard_visible })),

  setCalendarEvents: (calendar_events) => set({ calendar_events }),

  setCalendarProfile: (calendar_profile) => set({ calendar_profile }),

  setCalendarOverrides: (overrides) => {
    try {
      localStorage.setItem('dashboard_calendar_settings', JSON.stringify(overrides))
    } catch {}
    set({ calendar_overrides: overrides })
  },
}))

export default usePanelStore
