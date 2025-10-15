# 状态管理系统文档

## 📋 概述

本项目使用统一的状态管理系统，以 `src/config.js` 作为唯一真实来源（Single Source of Truth）。

所有状态字符串**必须**使用 `STATUS_DELIVERY_VALUES` 常量，**禁止硬编码**。

## 🎯 统一标准

### 标准格式规则
所有状态值使用 **首字母大写，其余小写** 的格式（缩写除外）：

| 状态键 | 标准值 | 说明 |
|--------|--------|------|
| `NEW_MOS` | `New MOS` | MOS 为缩写，保持大写 |
| `PREPARE_VEHICLE` | `Prepare Vehicle` | 首字母大写 |
| `ON_THE_WAY` | `On the way` | 注意：the 小写 |
| `ON_SITE` | `On Site` | 首字母大写 |
| `POD` | `POD` | 缩写，全大写 |
| `REPLAN_MOS_PROJECT` | `RePlan MOS Project` | RePlan 特殊格式 |
| `WAITING_PIC_FEEDBACK` | `Waiting PIC Feedback` | PIC 为缩写 |
| `REPLAN_MOS_LSP_DELAY` | `RePlan MOS Due To LSP Delay` | LSP 为缩写 |
| `CLOSE_BY_RN` | `Close By RN` | RN 为缩写 |
| `CANCEL_MOS` | `Cancel MOS` | MOS 为缩写 |
| `NO_STATUS` | `No Status` | 首字母大写 |

## 🏗️ 系统架构

```
┌─────────────────────────────────────────┐
│         src/config.js                   │  ← 唯一真实来源
│  - STATUS_DEFINITIONS                   │
│  - STATUS_DELIVERY_VALUES (常量)                 │
│  - STATUS_ALIAS_MAP (别名映射)          │
└────────────┬────────────────────────────┘
             │
             ├─────────────────┬─────────────────┬──────────────
             ↓                 ↓                 ↓
    ┌────────────────┐  ┌──────────────┐  ┌──────────────┐
    │ i18n 翻译文件   │  │  前端组件    │  │  后端 API    │
    │ public/locales/ │  │  src/views/  │  │  (别名映射)  │
    └────────────────┘  └──────────────┘  └──────────────┘
```

## 📁 文件说明

### 1. 核心配置文件

**`src/config.js`**
- 定义所有状态的标准值
- 定义别名映射（用于兼容后端各种格式）
- 导出常量供其他模块使用

```javascript
export const STATUS_DELIVERY_VALUES = {
  NEW_MOS: 'New MOS',
  PREPARE_VEHICLE: 'Prepare Vehicle',
  ON_THE_WAY: 'On the way',
  // ...
}

export const STATUS_ALIAS_MAP = {
  'ON THE WAY': 'On the way',      // 后端可能返回
  'IN TRANSIT': 'On the way',       // 后端可能返回
  '在途': 'On the way',              // 中文别名
  // ...
}
```

### 2. 翻译文件

**`public/locales/{lang}/admin.json`** - Admin 页面翻译
**`public/locales/{lang}/dashboard.json`** - Dashboard 页面翻译

**重要原则：**
- ✅ 翻译文件中的 **英文** 状态必须与 `config.js` 中的标准值完全一致
- ✅ 中文、印尼语可以自定义翻译
- ✅ 通过 `translationKey` 关联

示例：
```json
{
  "status.inTransit": "On the way",        // 英文：与 config.js 一致
  "status.prepareVehicle": "Prepare Vehicle"
}
```

### 3. 组件使用

#### Dashboard 组件
**`src/views/dashboard/setupDashboardPage.js`**
- `STATUS_ORDER` 数组：用于后端数据匹配（保持全大写以兼容现有 API）
- `STATUS_LABEL_KEYS`：映射到翻译键
- 显示文本通过 i18n 系统获取

#### Admin 组件
**`src/views/admin/setupAdminPage.js`**
- 直接使用 `STATUS_DELIVERY_VALUES` 常量
- 通过 `normalizeStatusDeliveryValue()` 函数统一处理

#### 状态卡片
**`src/views/admin/statusCards.js`**
- 使用标准状态值
- 通过 i18n 显示翻译后的文本

## 🔄 数据流程

### 后端 → 前端
```
后端返回 "ON THE WAY" 
    ↓
STATUS_ALIAS_MAP 映射
    ↓
标准值 "On the way"
    ↓
i18n 翻译系统
    ↓
显示 "On the way" (英文) / "在途" (中文)
```

### 前端 → 后端
```
用户选择状态
    ↓
使用 STATUS_DELIVERY_VALUES 标准值
    ↓
后端接收并处理
```

## ✅ 最佳实践

### DO ✅
1. **始终使用 `STATUS_DELIVERY_VALUES` 常量**
   ```javascript
   import { STATUS_DELIVERY_VALUES } from '../config.js';
   
   // ✅ 正确
   const cards = [
     { status: STATUS_DELIVERY_VALUES.ON_THE_WAY, label: STATUS_DELIVERY_VALUES.ON_THE_WAY }
   ];
   ```

2. **新增状态时先在 `config.js` 中定义**
3. **添加足够的别名以兼容后端可能的变体**
4. **翻译文件中英文状态与标准值保持一致**
5. **label 字段也使用 `STATUS_DELIVERY_VALUES` 常量，不要硬编码**

### DON'T ❌
1. **不要硬编码状态字符串**
   ```javascript
   // ❌ 错误
   const cards = [
     { status: 'On the way', label: 'On the way' }  // 硬编码
   ];
   
   // ✅ 正确
   const cards = [
     { status: STATUS_DELIVERY_VALUES.ON_THE_WAY, label: STATUS_DELIVERY_VALUES.ON_THE_WAY }
   ];
   ```

2. **不要在多个地方定义相同状态**
3. **不要跳过别名映射直接比较**
4. **不要在翻译文件中使用非标准格式**
5. **不要在 label 字段中使用硬编码字符串，即使看起来"只是显示用"**

## 🐛 常见问题

### Q: 为什么后端返回大写但前端显示首字母大写？
A: 通过 `STATUS_ALIAS_MAP` 进行映射。后端可以返回任何别名，前端统一转换为标准值。

### Q: 如何添加新状态？
A: 
1. 在 `config.js` 的 `STATUS_DEFINITIONS` 添加定义
2. 在各语言的翻译文件中添加翻译
3. 在需要的组件中使用 `STATUS_DELIVERY_VALUES.XXX`

### Q: 状态显示不一致怎么办？
A: 检查以下内容：
1. `config.js` 中的 `value` 字段
2. 翻译文件中对应的翻译键
3. 组件是否使用了 i18n 系统

## � 自动化检查

运行一致性检查脚本：
```bash
node scripts/check-status-consistency.js
```

## �📝 修改历史

### 2025-10-01 重构完成
- ✅ 统一所有状态使用 `STATUS_DELIVERY_VALUES` 常量，消除硬编码
- ✅ 修复拼写错误：`Nwe MOS` → `New MOS`
- ✅ 统一翻译文件格式（首字母大写）

## 🔗 相关文件清单

```
src/
  config.js                                    # 核心配置 ⭐
  views/
    admin/
      setupAdminPage.js                        # Admin 页面
      statusCards.js                           # 状态卡片
    dashboard/
      setupDashboardPage.js                    # Dashboard 页面

public/
  locales/
    en/
      admin.json                               # 英文翻译
      dashboard.json
    zh/
      admin.json                               # 中文翻译
      dashboard.json
    id/
      admin.json                               # 印尼语翻译
      dashboard.json
```

---

**维护者注意：** 修改状态相关代码时，请确保遵循本文档的规范，保持系统一致性。
