const STATUS_DEFINITIONS = [
  {
    key: 'NEW_MOS',
    value: 'New MOS',
    translationKey: 'status.newMos',
    fallbackLabel: '新建MOS',
    aliases: ['NEW MOS', '新建MOS', '新 MOS', 'MOS BARU', 'MOS Baru', 'Nwe MOS'],
  },
  {
    key: 'PREPARE_VEHICLE',
    value: 'Prepare Vehicle',
    translationKey: 'status.prepareVehicle',
    fallbackLabel: 'Prepare Vehicle',
    displayOverride: 'Prepare Vehicle',
    aliases: ['准备车辆', 'PREPARE VEHICLE', 'SIAPKAN KENDARAAN', 'PREPARE_VEHICLE'],
  },
  {
    key: 'ON_THE_WAY',
    value: 'On the way',
    translationKey: 'status.inTransit',
    fallbackLabel: 'On the way',
    displayOverride: 'On the way',
    aliases: [
      'ON THE WAY',
      'IN TRANSIT',
      'START TRANSPORT',
      '开始运输',
      '运输中',
      '在途',
      'SEDANG DIKIRIM',
      'MULAI PENGIRIMAN',
      'Mulai Pengiriman',
    ],
  },
  {
    key: 'ON_SITE',
    value: 'On Site',
    translationKey: 'status.onSite',
    fallbackLabel: 'On Site',
    displayOverride: 'On Site',
    aliases: [
      'ON SITE',
      'ARRIVED',
      '现场',
      '已到达',
      '到达',
      'SUDAH TIBA',
      'TIBA DI LOKASI',
      'DI LOKASI',
    ],
  },
  {
    key: 'POD',
    value: 'POD',
    translationKey: 'status.pod',
    fallbackLabel: 'POD',
    displayOverride: 'POD',
    aliases: ['PROOF OF DELIVERY'],
  },
  {
    key: 'REPLAN_MOS_PROJECT',
    value: 'RePlan MOS Project',
    translationKey: 'status.projectReschedule',
    fallbackLabel: '项目重排(Project)',
    aliases: ['REPLAN MOS PROJECT', '项目重排(Project)', 'PENJADWALAN ULANG PROYEK'],
  },
  {
    key: 'WAITING_PIC_FEEDBACK',
    value: 'Waiting PIC Feedback',
    translationKey: 'status.waitingFeedback',
    fallbackLabel: 'Waiting PIC Feedback',
    displayOverride: 'Waiting PIC Feedback',
    aliases: [
      'WAITING PIC FEEDBACK',
      'WAITING PHOTO FEEDBACK',
      '等待 PIC 反馈',
      '等待PIC反馈',
      '等待图片反馈',
      'MENUNGGU UMPAN BALIK PIC',
      'MENUNGGU UMPAN BALIK FOTO',
    ],
  },
  {
    key: 'REPLAN_MOS_LSP_DELAY',
    value: 'RePlan MOS Due To LSP Delay',
    translationKey: 'status.rescheduleLsp',
    fallbackLabel: '重新排期(LSP)',
    aliases: [
      'REPLAN MOS DUE TO LSP DELAY',
      '重新排期(LSP)',
      'PENJADWALAN ULANG (LSP)',
    ],
  },
  {
    key: 'CLOSE_BY_RN',
    value: 'Close By RN',
    translationKey: 'status.rnClosed',
    fallbackLabel: 'RN关闭',
    aliases: ['CLOSE BY RN', 'RN关闭', 'RN DITUTUP'],
  },
  {
    key: 'CANCEL_MOS',
    value: 'Cancel MOS',
    translationKey: 'status.cancelMos',
    fallbackLabel: '取消MOS',
    aliases: ['CANCEL MOS', '取消MOS', 'BATALKAN MOS'],
  },
  {
    key: 'NO_STATUS',
    value: 'No Status',
    translationKey: 'status.noStatus',
    fallbackLabel: '无状态',
    aliases: [
      'NO STATUS',
      'No Status',
      'no status',
      'NO_STATUS',
      '无状态',
      '無狀態',
      '沒有狀態',
      '没有状态',
      'TANPA STATUS',
    ],
  },
];

const DN_SCAN_STATUS_DEFINITIONS = [
  {
    key: 'ARRIVED_AT_WH',
    value: 'ARRIVED AT WH',
    translationKey: 'status.arrivedAtWh',
    fallbackLabel: '到达仓库',
    aliases: ['Arrived at WH', '到达仓库'],
  },
  {
    key: 'TRANSPORTING_FROM_WH',
    value: 'TRANSPORTING FROM WH',
    translationKey: 'status.transportingFromWh',
    fallbackLabel: '从仓库发出',
    aliases: ['Transporting from WH', '从仓库发出'],
  },
  {
    key: 'ARRIVED_AT_XD_PM',
    value: 'ARRIVED AT XD/PM',
    translationKey: 'status.arrivedAtXdPm',
    fallbackLabel: '到达XD/PM',
    aliases: ['Arrived at XD/PM', '到达XD/PM'],
  },
  {
    key: 'TRANSPORTING_FROM_XD_PM',
    value: 'TRANSPORTING FROM XD/PM',
    translationKey: 'status.transportingFromXdPm',
    fallbackLabel: '从XD/PM发出',
    aliases: ['Transporting from XD/PM', '从XD/PM发出'],
  },
  {
    key: 'ARRIVED_AT_SITE',
    value: 'ARRIVED AT SITE',
    translationKey: 'status.arrivedAtSite',
    fallbackLabel: '到达站点',
    aliases: ['Arrived at Site', '到达站点'],
  },
];

const buildValueMap = (definitions) =>
  Object.freeze(
    definitions.reduce((acc, { key, value }) => {
      acc[key] = value;
      return acc;
    }, {})
  );

const buildList = (definitions) => Object.freeze(definitions.map(({ value }) => value));

const buildDefinitionMap = (definitions, property) =>
  definitions.reduce((acc, definition) => {
    if (definition[property]) {
      acc[definition.value] = definition[property];
    }
    return acc;
  }, {});

const createAliasMap = (...definitionGroups) => {
  const map = {};
  definitionGroups.forEach((definitions) => {
    definitions.forEach(({ value, aliases = [] }) => {
      map[value] = value;
      aliases.forEach((alias) => {
        map[alias] = value;
      });
    });
  });
  return Object.freeze(map);
};

const runtimeEnv =
  (typeof import.meta !== 'undefined' && import.meta.env) ||
  (typeof process !== 'undefined' && process.env) ||
  {};

const parseUserLine = (rawValue) => {
  if (!rawValue) {
    return null;
  }

  const [id, name, password] = rawValue
    .split('|')
    .map((segment) => segment?.trim());

  if (!id || !name || !password) {
    return null;
  }

  return { id, name, password };
};

const loadRoleUsers = (prefix, fallback = []) => {
  const envKeys = Object.keys(runtimeEnv).filter((key) => key.startsWith(prefix));

  if (!envKeys.length) {
    return fallback;
  }

  return envKeys
    .sort((a, b) => a.localeCompare(b))
    .map((key) => parseUserLine(runtimeEnv[key]))
    .filter(Boolean);
};

export const TRANSPORT_MANAGER_ROLE_KEY = 'transportManager';

const ROLE_USER_PREFIXES = {
  lsp: 'VITE_ROLE_LSP_USER_',
  customer: 'VITE_ROLE_CUSTOMER_USER_',
  [TRANSPORT_MANAGER_ROLE_KEY]: 'VITE_ROLE_TRANSPORT_MANAGER_USER_',
};

export const STATUS_VALUES = buildValueMap(STATUS_DEFINITIONS);
export const STATUS_ORDERED_LIST = buildList(STATUS_DEFINITIONS);
export const DN_SCAN_STATUS_VALUES = buildValueMap(DN_SCAN_STATUS_DEFINITIONS);
export const DN_SCAN_STATUS_ORDERED_LIST = buildList(DN_SCAN_STATUS_DEFINITIONS);

export const STATUS_TRANSLATION_KEYS = Object.freeze({
  ...buildDefinitionMap(STATUS_DEFINITIONS, 'translationKey'),
  ...buildDefinitionMap(DN_SCAN_STATUS_DEFINITIONS, 'translationKey'),
});

export const STATUS_FALLBACK_LABELS = Object.freeze({
  ...buildDefinitionMap(STATUS_DEFINITIONS, 'fallbackLabel'),
  ...buildDefinitionMap(DN_SCAN_STATUS_DEFINITIONS, 'fallbackLabel'),
});

export const STATUS_DISPLAY_OVERRIDES = Object.freeze(
  STATUS_DEFINITIONS.reduce((acc, { value, displayOverride }) => {
    if (displayOverride) {
      acc[value] = displayOverride;
    }
    return acc;
  }, {})
);

export const STATUS_ALIAS_MAP = createAliasMap(
  STATUS_DEFINITIONS,
  DN_SCAN_STATUS_DEFINITIONS
);

export const ROLE_DEFINITIONS = {
  lsp: {
    key: 'lsp',
    label: 'LSP',
    description: 'LSP',
    permissions: {
      canEdit: true,
      canDelete: false,
      allowRemark: true,
      allowPhoto: true,
      requireStatusSelection: true,
      statusOptions: [...DN_SCAN_STATUS_ORDERED_LIST],
    },
    statusHighlights: [
      { status: STATUS_VALUES.NEW_MOS },
      { status: STATUS_VALUES.CANCEL_MOS },
      { status: STATUS_VALUES.CLOSE_BY_RN },
      { status: STATUS_VALUES.WAITING_PIC_FEEDBACK },
    ],
    users: loadRoleUsers(ROLE_USER_PREFIXES.lsp),
  },
  customer: {
    key: 'customer',
    label: '项目组',
    description: 'Project Team',
    permissions: {
      canEdit: true,
      canDelete: true,
      allowRemark: true,
      allowPhoto: false,
      requireStatusSelection: false,
      statusOptions: [...DN_SCAN_STATUS_ORDERED_LIST],
    },
    statusHighlights: [
      { status: STATUS_VALUES.NEW_MOS },
      { status: STATUS_VALUES.POD },
    ],
    users: loadRoleUsers(ROLE_USER_PREFIXES.customer),
  },
  [TRANSPORT_MANAGER_ROLE_KEY]: {
    key: TRANSPORT_MANAGER_ROLE_KEY,
    label: '运输经理',
    description: 'Transport Manager',
    permissions: {
      canEdit: true,
      canDelete: true,
      allowRemark: true,
      allowPhoto: true,
      requireStatusSelection: false,
      statusOptions: [...DN_SCAN_STATUS_ORDERED_LIST],
    },
    statusHighlights: [
      { status: STATUS_VALUES.NEW_MOS },
      { status: STATUS_VALUES.CANCEL_MOS },
      { status: STATUS_VALUES.CLOSE_BY_RN },
      { status: STATUS_VALUES.REPLAN_MOS_PROJECT },
      { status: STATUS_VALUES.REPLAN_MOS_LSP_DELAY },
      { status: STATUS_VALUES.PREPARE_VEHICLE },
      { status: STATUS_VALUES.ON_THE_WAY },
    ],
    users: loadRoleUsers(ROLE_USER_PREFIXES[TRANSPORT_MANAGER_ROLE_KEY]),
  },
};

export const ROLE_LIST = Object.values(ROLE_DEFINITIONS);
