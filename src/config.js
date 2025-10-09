const STATUS_DELIVERY_DEFINITIONS = [
  // {
  //   key: 'ARRIVED_AT_WH',
  //   value: 'ARRIVED AT WH',
  //   translationKey: 'status.arrivedAtWh',
  //   fallbackLabel: '到达仓库',
  //   aliases: ['Arrived at WH'],
  // },
  {
    key: 'TRANSPORTING_FROM_WH',
    value: 'TRANSPORTING FROM WH',
    translationKey: 'status.transportingFromWh',
    fallbackLabel: '从仓库发出',
    aliases: ['Transporting from WH'],
  },
  {
    key: 'ARRIVED_AT_XD_PM',
    value: 'ARRIVED AT XD/PM',
    translationKey: 'status.arrivedAtXdPm',
    fallbackLabel: '到达XD/PM',
    aliases: ['Arrived at XD/PM'],
  },
  {
    key: 'TRANSPORTING_FROM_XD_PM',
    value: 'TRANSPORTING FROM XD/PM',
    translationKey: 'status.transportingFromXdPm',
    fallbackLabel: '从XD/PM发出',
    aliases: ['Transporting from XD/PM'],
  },
  {
    key: 'ARRIVED_AT_SITE',
    value: 'ARRIVED AT SITE',
    translationKey: 'status.arrivedAtSite',
    fallbackLabel: '到达站点',
    aliases: ['Arrived at Site'],
  },
  {
    key: 'POD',
    value: 'POD',
    translationKey: 'status.pod',
    fallbackLabel: 'POD',
  },
];

const STATUS_SITE_DEFINITIONS = [
  {
    key: 'PIC_NOT_CONFIRMED',
    value: 'PIC not confirmed',
    translationKey: 'status.picNotConfirmed',
    fallbackLabel: 'PIC not confirmed',
    displayOverride: 'PIC not confirmed',
    aliases: ['PIC NOT CONFIRMED'],
  },
  {
    key: 'PIC_CONFIRMED',
    value: 'PIC confirmed',
    translationKey: 'status.picConfirmed',
    fallbackLabel: 'PIC confirmed',
    displayOverride: 'PIC confirmed',
    aliases: ['PIC CONFIRMED'],
  },
  {
    key: 'PERMIT_ISSUE',
    value: 'Permit issue',
    translationKey: 'status.permitIssue',
    fallbackLabel: 'Permit issue',
    displayOverride: 'Permit issue',
    aliases: ['PERMIT ISSUE'],
  },
  {
    key: 'COMMON_CASE_ISSUE',
    value: 'Common case issue',
    translationKey: 'status.commonCaseIssue',
    fallbackLabel: 'Common case issue',
    displayOverride: 'Common case issue',
    aliases: ['COMMON CASE ISSUE'],
  },
  {
    key: 'REPLAN_MOS',
    value: 'Replan MOS',
    translationKey: 'status.replanMos',
    fallbackLabel: 'Replan MOS',
    displayOverride: 'Replan MOS',
    aliases: ['REPLAN MOS'],
  },
  {
    key: 'CANCEL_MOS',
    value: 'Cancel MOS',
    translationKey: 'status.cancelMos',
    fallbackLabel: 'Cancel MOS',
    displayOverride: 'Cancel MOS',
    aliases: ['CANCEL MOS'],
  }
];

const toCamelCaseKey = (raw) =>
  String(raw || '')
    .toLowerCase()
    .split('_')
    .filter(Boolean)
    .map((segment, index) =>
      index === 0 ? segment : segment.charAt(0).toUpperCase() + segment.slice(1)
    )
    .join('');

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

export const STATUS_DELIVERY_VALUES = buildValueMap(STATUS_DELIVERY_DEFINITIONS);
export const STATUS_DELIVERY_ORDERED_LIST = buildList(STATUS_DELIVERY_DEFINITIONS);
export const STATUS_DELIVERY_ITEMS = Object.freeze(
  STATUS_DELIVERY_DEFINITIONS.map(({ key, value, translationKey, fallbackLabel }) => {
    const camelKey = toCamelCaseKey(key);
    return {
      key,
      value,
      translationKey,
      fallbackLabel,
      camelKey,
      filterLabelKey: `status.filter.${camelKey}`,
    };
  })
);

export const STATUS_DELIVERY_VALUE_TO_KEY = Object.freeze({
  ...buildDefinitionMap(STATUS_DELIVERY_DEFINITIONS, 'translationKey'),
});


export const STATUS_DELIVERY_DISPLAY_OVERRIDES = Object.freeze(
  STATUS_SITE_DEFINITIONS.reduce((acc, { value, displayOverride }) => {
    if (displayOverride) {
      acc[value] = displayOverride;
    }
    return acc;
  }, {})
);

export const STATUS_DELIVERY_ALIAS_MAP = createAliasMap(
  STATUS_DELIVERY_DEFINITIONS
);

export const STATUS_SITE_VALUES = buildValueMap(STATUS_SITE_DEFINITIONS);
export const STATUS_SITE_ORDERED_LIST = buildList(STATUS_SITE_DEFINITIONS);
export const STATUS_SITE_ITEMS = Object.freeze(
  STATUS_SITE_DEFINITIONS.map(({ key, value, translationKey, fallbackLabel }) => {
    const camelKey = toCamelCaseKey(key);
    return {
      key,
      value,
      translationKey,
      fallbackLabel,
      camelKey,
      filterLabelKey: `status.filter.${camelKey}`,
    };
  })
);

export const STATUS_SITE_VALUE_TO_KEY = Object.freeze(
  buildDefinitionMap(STATUS_SITE_DEFINITIONS, 'translationKey')
);

export const STATUS_SITE_DISPLAY_OVERRIDES = Object.freeze(
  buildDefinitionMap(STATUS_SITE_DEFINITIONS, 'displayOverride')
);

export const STATUS_SITE_ALIAS_MAP = createAliasMap(
  STATUS_SITE_DEFINITIONS
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
      requireStatusDeliverySelection: true,
      statusDeliveryOptions: [...STATUS_DELIVERY_ORDERED_LIST],
      statusSiteOptions: [...STATUS_SITE_ORDERED_LIST],
    },
    statusDeliveryHighlights: [],
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
      requireStatusDeliverySelection: false,
      statusDeliveryOptions: [...STATUS_DELIVERY_ORDERED_LIST],
      statusSiteOptions: [...STATUS_SITE_ORDERED_LIST],
    },
    statusDeliveryHighlights: [
      { status_delivery: STATUS_SITE_VALUES.NEW_MOS },
      { status_delivery: STATUS_SITE_VALUES.POD },
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
      requireStatusDeliverySelection: false,
      statusDeliveryOptions: [...STATUS_DELIVERY_ORDERED_LIST],
      statusSiteOptions: [...STATUS_SITE_ORDERED_LIST],
    },
    statusDeliveryHighlights: [],
    users: loadRoleUsers(ROLE_USER_PREFIXES[TRANSPORT_MANAGER_ROLE_KEY]),
  },
};

export const ROLE_LIST = Object.values(ROLE_DEFINITIONS);
