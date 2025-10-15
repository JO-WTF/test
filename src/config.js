const STATUS_DELIVERY_DEFINITIONS = [
  {
    key: 'ARRIVED_AT_WH',
    value: 'ARRIVED AT WH',
    translationKey: 'statusDelivery.arrivedAtWh',
  },
  {
    key: 'DEPARTED_FROM_WH',
    value: 'DEPARTED FROM WH',
    translationKey: 'statusDelivery.departedFromWh',
    aliases: ['TRANSPORTING FROM WH'],
  },
  {
    key: 'ARRIVED_AT_XD_PM',
    value: 'ARRIVED AT XD/PM',
    translationKey: 'statusDelivery.arrivedAtXdPm',
  },
  {
    key: 'DEPARTED_FROM_XD_PM',
    value: 'DEPARTED FROM XD/PM',
    translationKey: 'statusDelivery.departedFromXdPm',
    aliases: ['TRANSPORTING FROM XD/PM'],
  },
  {
    key: 'ARRIVED_AT_SITE',
    value: 'ARRIVED AT SITE',
    translationKey: 'statusDelivery.arrivedAtSite',
  },
  {
    key: 'POD',
    value: 'POD',
    translationKey: 'statusDelivery.pod',
  },
  {
    key: 'NO_STATUS',
    value: 'No Status',
    translationKey: 'statusDelivery.noStatus',
  }
];

const STATUS_SITE_DEFINITIONS = [
  {
    key: 'PIC_NOT_CONFIRMED',
    value: 'PIC not confirmed',
    translationKey: 'statusSite.picNotConfirmed',
  },
  {
    key: 'PIC_CONFIRMED',
    value: 'PIC confirmed',
    translationKey: 'statusSite.picConfirmed',
  },
  {
    key: 'PERMIT_ISSUE',
    value: 'Permit Issue',
    translationKey: 'statusSite.permitIssue',
  },
  {
    key: 'COMCASE_ISSUE',
    value: 'Comcase Issue',
    translationKey: 'statusSite.comcaseIssue',
  },
  {
    key: 'REPLAN_MOS',
    value: 'Replan MOS',
    translationKey: 'statusSite.replanMos',
  },
  {
    key: 'CANCEL_MOS',
    value: 'Cancel MOS',
    translationKey: 'statusSite.cancelMos',
  }
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

export const STATUS_DELIVERY_VALUES = buildValueMap(STATUS_DELIVERY_DEFINITIONS);
export const STATUS_DELIVERY_ORDERED_LIST = buildList(STATUS_DELIVERY_DEFINITIONS);
export const STATUS_DELIVERY_ITEMS = Object.freeze(
  STATUS_DELIVERY_DEFINITIONS.map(({ key, value, translationKey }) => {
    return {
      key,
      value,
      translationKey,
      filterLabelKey: translationKey,
    };
  })
);

export const STATUS_DELIVERY_VALUE_TO_KEY = Object.freeze({
  ...buildDefinitionMap(STATUS_DELIVERY_DEFINITIONS, 'translationKey'),
});


export const STATUS_DELIVERY_ALIAS_MAP = createAliasMap(
  STATUS_DELIVERY_DEFINITIONS
);

export const STATUS_SITE_VALUES = buildValueMap(STATUS_SITE_DEFINITIONS);
export const STATUS_SITE_ORDERED_LIST = buildList(STATUS_SITE_DEFINITIONS);
const roleDefinitions = {
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
  // Show all delivery status cards for LSP by default (prepend Total)
  statusDeliveryHighlights: ['Total', ...STATUS_DELIVERY_ORDERED_LIST],
    // Show all site status cards for LSP by default
    statusSiteHighlights: [...STATUS_SITE_ORDERED_LIST],
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
  // Show all delivery status cards for Transport Manager by default (prepend Total)
  statusDeliveryHighlights: ['Total', ...STATUS_DELIVERY_ORDERED_LIST],
    // Show all site status cards for Transport Manager by default
    statusSiteHighlights: [...STATUS_SITE_ORDERED_LIST],
    users: loadRoleUsers(ROLE_USER_PREFIXES[TRANSPORT_MANAGER_ROLE_KEY]),
  },
};

export const ROLE_LIST = Object.values(roleDefinitions);
