export const ROLE_DEFINITIONS = {
  lsp: {
    key: 'lsp',
    label: 'LSP',
    description: 'LSP',
    passwordHash: 'ff9921881272fc8f541c3451adad7ea8a41d7fff750dc0fe6fe53983cac7e29c',
    permissions: {
      canEdit: true,
      canDelete: false,
      allowRemark: true,
      allowPhoto: true,
      requireStatusSelection: true,
      statusOptions: ['准备车辆', '开始运输', '重新排期(LSP)'],
    },
  },
  customer: {
    key: 'customer',
    label: '客户',
    description: 'Customer',
    passwordHash: 'dc5db5e9734cd96ddf7d9d743544a391930b56caba72ee3d87c99d8d6fc488f0',
    permissions: {
      canEdit: true,
      canDelete: true,
      allowRemark: true,
      allowPhoto: false,
      requireStatusSelection: false,
      statusOptions: ['项目重排(Project)', '取消MOS', 'RN关闭'],
    },
  },
  transportManager: {
    key: 'transportManager',
    label: '运输经理',
    description: 'Transport Manager',
    passwordHash: '2257dfd0560dc16bf19ef3dcf251134ce5e3600594ce6e8a36625d3750f6ffa9',
    permissions: {
      canEdit: true,
      canDelete: true,
      allowRemark: true,
      allowPhoto: true,
      requireStatusSelection: false,
      statusOptions: [
        '准备车辆',
        '开始运输',
        '重新排期(LSP)',
        '项目重排(Project)',
        '取消MOS',
        'RN关闭',
        '运输中',
        '过夜',
        '已到达',
      ],
    },
  },
};

export const ROLE_LIST = Object.values(ROLE_DEFINITIONS);
