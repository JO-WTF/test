// 管理页面常量配置
import {
  ROLE_LIST,
  STATUS_VALUES,
  STATUS_TRANSLATION_KEYS,
  STATUS_ALIAS_MAP,
  DN_SCAN_STATUS_ORDERED_LIST,
  DN_SCAN_STATUS_VALUES,
  TRANSPORT_MANAGER_ROLE_KEY,
} from '../../config.js';

// Re-export constants from config.js for use in other modules
export { STATUS_VALUES, DN_SCAN_STATUS_VALUES, TRANSPORT_MANAGER_ROLE_KEY };

// 角色相关常量
export const ROLE_MAP = new Map((ROLE_LIST || []).map((role) => [role.key, role]));

// 存储相关常量
export const AUTH_STORAGE_KEY = 'jakarta-admin-auth-state';

// 状态相关常量
export const STATUS_VALUE_TO_KEY = STATUS_TRANSLATION_KEYS || {};
export const STATUS_ALIAS_LOOKUP = STATUS_ALIAS_MAP || {};
export const STATUS_KNOWN_VALUES = new Set(Object.keys(STATUS_VALUE_TO_KEY));
export const STATUS_NOT_EMPTY_VALUE = '__NOT_EMPTY__';
export const STATUS_MISMATCH_TOOLTIP_FALLBACK =
  '配送状态(status_delivery)与司机上传的货物状态(status)不一致，请检查并更新。';
export const STATUS_ANY_VALUE = '';
export const DEFAULT_STATUS_VALUE = STATUS_ANY_VALUE;

// 时区相关常量
export const PLAN_MOS_TIME_ZONE = 'Asia/Jakarta';
export const PLAN_MOS_TIMEZONE_OFFSET_MINUTES = 7 * 60;
export const JAKARTA_UTC_OFFSET_MINUTES = 7 * 60;

// 表格列数常量
export const SUMMARY_BASE_COLUMN_COUNT = 11;
export const SUMMARY_COLUMN_WITH_ACTIONS_COUNT = 12;

// 归档相关常量
export const ARCHIVE_THRESHOLD_DAYS = 55;

// 状态卡片配置
export const TRANSPORT_MANAGER_STATUS_CARDS = [
  { status: STATUS_VALUES.PREPARE_VEHICLE, label: STATUS_VALUES.PREPARE_VEHICLE },
  { status: STATUS_VALUES.ON_THE_WAY, label: STATUS_VALUES.ON_THE_WAY },
  { status: STATUS_VALUES.ON_SITE, label: STATUS_VALUES.ON_SITE },
  { status: STATUS_VALUES.POD, label: STATUS_VALUES.POD },
  { status: STATUS_VALUES.WAITING_PIC_FEEDBACK, label: STATUS_VALUES.WAITING_PIC_FEEDBACK },
  {
    status: STATUS_VALUES.REPLAN_MOS_LSP_DELAY,
    label: STATUS_VALUES.REPLAN_MOS_LSP_DELAY,
  },
  { status: STATUS_VALUES.REPLAN_MOS_PROJECT, label: STATUS_VALUES.REPLAN_MOS_PROJECT },
  { status: STATUS_VALUES.CANCEL_MOS, label: STATUS_VALUES.CANCEL_MOS },
  { status: STATUS_VALUES.CLOSE_BY_RN, label: STATUS_VALUES.CLOSE_BY_RN },
  { status: STATUS_VALUES.NO_STATUS, label: STATUS_VALUES.NO_STATUS },
];

export const STATUS_DELIVERY_OPTIONS = [
  STATUS_VALUES.PREPARE_VEHICLE,
  STATUS_VALUES.ON_THE_WAY,
  STATUS_VALUES.ON_SITE,
  STATUS_VALUES.POD,
  STATUS_VALUES.WAITING_PIC_FEEDBACK,
];

export const DEFAULT_MODAL_STATUS_ORDER =
  Array.isArray(DN_SCAN_STATUS_ORDERED_LIST) &&
  DN_SCAN_STATUS_ORDERED_LIST.length
    ? DN_SCAN_STATUS_ORDERED_LIST.map((value) =>
        typeof value === 'string' ? value.trim() : String(value || '')
      ).filter(Boolean)
    : [
        'ARRIVED AT WH',
        'TRANSPORTING FROM WH',
        'ARRIVED AT XD/PM',
        'TRANSPORTING FROM XD/PM',
        'ARRIVED AT SITE',
      ];

// DN详情展开时显示的字段及其顺序
// 只有在此列表中的字段才会在展开详情时显示
export const DN_DETAIL_KEYS = [
  'du_id',
  'lsp',
  'region',
  'plan_mos_date',
  'area',
  'status_wh',
  'status_delivery',
  'status',
  'update_count',
  'issue_remark',
  'remark',
  'photo_url',
  'lonlat',
  'mos_given_time',
  'expected_arrival_time_from_project',
  'hw_tracker',
  'lsp_tracker',
  'driver_contact_name',
  'driver_contact_number',
  'transportation_time',
  'distance_poll_mover_to_site',
  'delivery_type_a_to_b',
  'estimate_depart_from_start_point_etd',
  'estimate_arrive_sites_time_eta',
  'actual_depart_from_start_point_atd',
  'actual_arrive_time_ata',
  'mos_attempt_1st_time',
  'mos_attempt_2nd_time',
  'mos_attempt_3rd_time',
  'mos_attempt_4th_time',
  'mos_attempt_5th_time',
  'mos_attempt_6th_time',
  'project_request',
  'mos_type',
  'subcon',
  'subcon_receiver_contact_number',
  'gs_sheet',
  'gs_row',
  'created_at',
  'last_updated_by',
  'latest_record_created_at',
];

export const DETAIL_INPUT_FIELD_SET = new Set(
  [
    'distance_poll_mover_to_site',
    'driver_contact_name',
    'driver_contact_number',
    'delivery_type_a_to_b',
    'transportation_time',
    'estimate_depart_from_start_point_etd',
    'estimate_arrive_sites_time_eta',
  ].map((key) => key.toLowerCase())
);

export const REGION_FIELD = 'region';
export const PLAN_MOS_DATE_FIELD = 'plan_mos_date';
export const ISSUE_REMARK_FIELD = 'issue_remark';
export const STATUS_DELIVERY_FIELD = 'status_delivery';
export const UPDATED_AT_FIELD = 'updated_at';
export const LSP_FIELD = 'lsp';
export const LAT_FIELD = 'lat';
export const LNG_FIELD = 'lng';
export const PHOTO_FIELD = 'photo_url';

export const SUMMARY_FIELD_KEYS = new Set([
  'dn_number',
  'du_id',
  'lsp',
  'region',
  'plan_mos_date',
  'issue_remark',
  'status_delivery',
  'status',
  'remark',
  'photo_url',
  'lat',
  'lng',
  'latest_record_created_at',
  'update_count',
]);

export const ICON_MARKUP = Object.freeze({
  photo:
    '<svg aria-hidden="true" focusable="false" class="icon-svg" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path fill="currentColor" d="M4 7a2 2 0 0 1 2-2h2l1-1h6l1 1h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z"/><circle cx="12" cy="12" r="3.25" fill="currentColor"/></svg>',
  map:
    '<svg aria-hidden="true" focusable="false" class="icon-svg" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path fill="currentColor" d="M12 2a6 6 0 0 0-6 6c0 4.63 6 12 6 12s6-7.37 6-12a6 6 0 0 0-6-6zm0 3a3 3 0 1 1 0 6 3 3 0 0 1 0-6z"/></svg>',
  edit:
    '<svg aria-hidden="true" focusable="false" class="icon-svg" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path fill="currentColor" d="M5 17.5V21h3.5L18.37 11.13a1 1 0 0 0 0-1.41l-2.09-2.09a1 1 0 0 0-1.41 0L5 17.5zm12.71-9.21 1.4-1.4a1 1 0 0 0 0-1.42l-1.6-1.6a1 1 0 0 0-1.42 0l-1.4 1.4z"/></svg>',
  delete:
    '<svg aria-hidden="true" focusable="false" class="icon-svg" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path fill="currentColor" d="M9 3h6l.62 1.25H21V6H3V4.25h5.38L9 3zm-3 4h12l-.84 10.07A2 2 0 0 1 15.18 21H8.82a2 2 0 0 1-1.98-1.93z"/></svg>',
});

export const HIDDEN_DETAIL_FIELDS = new Set(['dn_number', 'id', 'lng', 'lat']);
