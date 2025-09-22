export const STATUS_VALUES = {
  ARRIVED_AT_WH: 'ARRIVED AT WH',
  TRANSPORTING_FROM_WH: 'TRANSPORTING FROM WH',
  ARRIVED_AT_XD_PM: 'ARRIVED AT XD/PM',
  TRANSPORTING_FROM_XD_PM: 'TRANSPORTING FROM XD/PM',
  ARRIVED_AT_SITE: 'ARRIVED AT SITE',
};

export const STATUS_ORDERED_LIST = [
  STATUS_VALUES.ARRIVED_AT_WH,
  STATUS_VALUES.TRANSPORTING_FROM_WH,
  STATUS_VALUES.ARRIVED_AT_XD_PM,
  STATUS_VALUES.TRANSPORTING_FROM_XD_PM,
  STATUS_VALUES.ARRIVED_AT_SITE,
];

export const STATUS_TRANSLATION_KEYS = {
  [STATUS_VALUES.ARRIVED_AT_WH]: 'status.arrivedWh',
  [STATUS_VALUES.TRANSPORTING_FROM_WH]: 'status.departWh',
  [STATUS_VALUES.ARRIVED_AT_XD_PM]: 'status.arrivedXdPm',
  [STATUS_VALUES.TRANSPORTING_FROM_XD_PM]: 'status.departXdPm',
  [STATUS_VALUES.ARRIVED_AT_SITE]: 'status.arrivedSite',
};

export const STATUS_FALLBACK_LABELS = {
  [STATUS_VALUES.ARRIVED_AT_WH]: '到达仓库',
  [STATUS_VALUES.TRANSPORTING_FROM_WH]: '从仓库出发',
  [STATUS_VALUES.ARRIVED_AT_XD_PM]: '到达XD/PM',
  [STATUS_VALUES.TRANSPORTING_FROM_XD_PM]: '从XD/PM出发',
  [STATUS_VALUES.ARRIVED_AT_SITE]: '到达站点',
};

export const STATUS_ALIAS_MAP = {
  [STATUS_VALUES.ARRIVED_AT_WH]: STATUS_VALUES.ARRIVED_AT_WH,
  'ARRIVED AT WAREHOUSE': STATUS_VALUES.ARRIVED_AT_WH,
  'ARRIVE AT WAREHOUSE': STATUS_VALUES.ARRIVED_AT_WH,
  '到达仓库': STATUS_VALUES.ARRIVED_AT_WH,
  '到達倉庫': STATUS_VALUES.ARRIVED_AT_WH,

  [STATUS_VALUES.TRANSPORTING_FROM_WH]: STATUS_VALUES.TRANSPORTING_FROM_WH,
  'DEPART WAREHOUSE': STATUS_VALUES.TRANSPORTING_FROM_WH,
  'DEPART FROM WAREHOUSE': STATUS_VALUES.TRANSPORTING_FROM_WH,
  '从仓库出发': STATUS_VALUES.TRANSPORTING_FROM_WH,
  '離開倉庫': STATUS_VALUES.TRANSPORTING_FROM_WH,

  [STATUS_VALUES.ARRIVED_AT_XD_PM]: STATUS_VALUES.ARRIVED_AT_XD_PM,
  'ARRIVED AT XD': STATUS_VALUES.ARRIVED_AT_XD_PM,
  'ARRIVED AT PM': STATUS_VALUES.ARRIVED_AT_XD_PM,
  'ARRIVED AT XD/PM': STATUS_VALUES.ARRIVED_AT_XD_PM,
  '到达XD/PM': STATUS_VALUES.ARRIVED_AT_XD_PM,

  [STATUS_VALUES.TRANSPORTING_FROM_XD_PM]: STATUS_VALUES.TRANSPORTING_FROM_XD_PM,
  'DEPART XD/PM': STATUS_VALUES.TRANSPORTING_FROM_XD_PM,
  '从XD/PM出发': STATUS_VALUES.TRANSPORTING_FROM_XD_PM,

  [STATUS_VALUES.ARRIVED_AT_SITE]: STATUS_VALUES.ARRIVED_AT_SITE,
  'ARRIVED AT SITE': STATUS_VALUES.ARRIVED_AT_SITE,
  '到达站点': STATUS_VALUES.ARRIVED_AT_SITE,
  '到達站點': STATUS_VALUES.ARRIVED_AT_SITE,
};

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
      statusOptions: STATUS_ORDERED_LIST,
    },
    statusHighlights: [
      { status: STATUS_VALUES.ARRIVED_AT_WH },
      { status: STATUS_VALUES.TRANSPORTING_FROM_WH },
      { status: STATUS_VALUES.ARRIVED_AT_XD_PM },
      { status: STATUS_VALUES.TRANSPORTING_FROM_XD_PM },
      { status: STATUS_VALUES.ARRIVED_AT_SITE },
    ],
    users: [
      { id: 'lsp-operator-01', name: 'LSP Operator 01', password: 'LSP-123456' },
      { id: 'lsp-operator-02', name: 'LSP Operator 02', password: 'LSP-234567' },
      { id: 'lsp-operator-03', name: 'LSP Operator 03', password: 'LSP-345678' },
      { id: 'lsp-operator-04', name: 'LSP Operator 04', password: 'LSP-456789' },
      { id: 'lsp-operator-05', name: 'LSP Operator 05', password: 'LSP-567890' },
      { id: 'lsp-operator-06', name: 'LSP Operator 06', password: 'LSP-678901' },
      { id: 'lsp-operator-07', name: 'LSP Operator 07', password: 'LSP-789012' },
      { id: 'lsp-operator-08', name: 'LSP Operator 08', password: 'LSP-890123' },
      { id: 'lsp-operator-09', name: 'LSP Operator 09', password: 'LSP-901234' },
      { id: 'lsp-operator-10', name: 'LSP Operator 10', password: 'LSP-012345' },
    ],
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
      statusOptions: STATUS_ORDERED_LIST,
    },
    statusHighlights: [
      { status: STATUS_VALUES.ARRIVED_AT_WH },
      { status: STATUS_VALUES.ARRIVED_AT_SITE },
    ],
    users: [
      { id: 'project-team-01', name: 'Project Team 01', password: 'HW-PROJ-888888' },
      { id: 'project-team-02', name: 'Project Team 02', password: 'HW-PROJ-777777' },
      { id: 'project-team-03', name: 'Project Team 03', password: 'HW-PROJ-666666' },
      { id: 'project-team-04', name: 'Project Team 04', password: 'HW-PROJ-555555' },
      { id: 'project-team-05', name: 'Project Team 05', password: 'HW-PROJ-444444' },
      { id: 'project-team-06', name: 'Project Team 06', password: 'HW-PROJ-333333' },
      { id: 'project-team-07', name: 'Project Team 07', password: 'HW-PROJ-222222' },
      { id: 'project-team-08', name: 'Project Team 08', password: 'HW-PROJ-111111' },
      { id: 'project-team-09', name: 'Project Team 09', password: 'HW-PROJ-999999' },
      { id: 'project-team-10', name: 'Project Team 10', password: 'HW-PROJ-135791' },
    ],
  },
  transportManager: {
    key: 'transportManager',
    label: '运输经理',
    description: 'Transport Manager',
    permissions: {
      canEdit: true,
      canDelete: true,
      allowRemark: true,
      allowPhoto: true,
      requireStatusSelection: false,
      statusOptions: STATUS_ORDERED_LIST,
    },
    statusHighlights: [
      { status: STATUS_VALUES.ARRIVED_AT_WH },
      { status: STATUS_VALUES.TRANSPORTING_FROM_WH },
      { status: STATUS_VALUES.ARRIVED_AT_XD_PM },
      { status: STATUS_VALUES.TRANSPORTING_FROM_XD_PM },
      { status: STATUS_VALUES.ARRIVED_AT_SITE },
    ],
    users: [
      { id: 'tm-lead-01', name: 'Transport Manager 01', password: 'HW-LSM-888888' },
      { id: 'tm-lead-02', name: 'Transport Manager 02', password: 'HW-LSM-777234' },
      { id: 'tm-lead-03', name: 'Transport Manager 03', password: 'HW-LSM-666345' },
      { id: 'tm-lead-04', name: 'Transport Manager 04', password: 'HW-LSM-555456' },
      { id: 'tm-lead-05', name: 'Transport Manager 05', password: 'HW-LSM-444567' },
      { id: 'tm-lead-06', name: 'Transport Manager 06', password: 'HW-LSM-333678' },
      { id: 'tm-lead-07', name: 'Transport Manager 07', password: 'HW-LSM-222789' },
      { id: 'tm-lead-08', name: 'Transport Manager 08', password: 'HW-LSM-111890' },
      { id: 'tm-lead-09', name: 'Transport Manager 09', password: 'HW-LSM-999012' },
      { id: 'tm-lead-10', name: 'Transport Manager 10', password: 'HW-LSM-246801' },
      { id: 'tm-lead-11', name: 'Transport Manager 11', password: 'HW-LSM-357902' },
      { id: 'tm-lead-12', name: 'Transport Manager 12', password: 'HW-LSM-468013' },
      { id: 'tm-lead-13', name: 'Transport Manager 13', password: 'HW-LSM-579124' },
      { id: 'tm-lead-14', name: 'Transport Manager 14', password: 'HW-LSM-680235' },
      { id: 'tm-lead-15', name: 'Transport Manager 15', password: 'HW-LSM-791346' },
      { id: 'tm-lead-16', name: 'Transport Manager 16', password: 'HW-LSM-802457' },
      { id: 'tm-lead-17', name: 'Transport Manager 17', password: 'HW-LSM-913568' },
      { id: 'tm-lead-18', name: 'Transport Manager 18', password: 'HW-LSM-024679' },
      { id: 'tm-lead-19', name: 'Transport Manager 19', password: 'HW-LSM-135680' },
      { id: 'tm-lead-20', name: 'Transport Manager 20', password: 'HW-LSM-246791' },
    ],
  },
};

export const ROLE_LIST = Object.values(ROLE_DEFINITIONS);
