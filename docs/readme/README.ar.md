<div align="center">
  <img src="../../resources/sookool-app-icon-preview.png" width="112" alt="أيقونة SooKool Agent Helper" />

  <h1>SooKool Agent Helper</h1>

  <p><strong>مساحة عمل محلية على سطح المكتب لاكتشاف مهارات الوكلاء وتنظيمها ومعاينتها ونقلها وتثبيتها.</strong></p>

  <p>
    <a href="https://www.electronjs.org/"><img alt="Electron" src="https://img.shields.io/badge/Electron-desktop-47848F?logo=electron&logoColor=white" /></a>
    <a href="https://react.dev/"><img alt="React" src="https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=20232A" /></a>
    <a href="https://www.typescriptlang.org/"><img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white" /></a>
    <a href="../../LICENSE"><img alt="ترخيص MIT" src="https://img.shields.io/badge/License-MIT-F4511E.svg" /></a>
  </p>
</div>

<div align="center">
  <a href="../../README.md">English</a> ·
  <a href="README.zh-CN.md">简体中文</a> ·
  <a href="README.zh-HK.md">繁體中文（香港）</a> ·
  <a href="README.ja.md">日本語</a> ·
  <a href="README.fr.md">Français</a> ·
  <a href="README.ko.md">한국어</a> ·
  <a href="README.es.md">Español</a> ·
  <a href="README.pt-BR.md">Português</a> ·
  <strong>العربية</strong>
</div>

## نظرة عامة

تخزّن تطبيقات الوكلاء المهارات في مجلدات مختلفة على مستوى النظام والمجلدات المشتركة والمشاريع. يجمع SooKool Agent Helper هذه المواقع المتفرقة في مكتبة واحدة، ويضيف سوقًا موحدًا، فلا تحتاج إلى حفظ قواعد المجلدات أو نسخ الحزم يدويًا.

يركز التطبيق على إدارة مهارات الوكلاء محليًا. وهو يعرض التطبيقات ذات الصلة والمجلدات الصالحة التي يكتشفها فقط، مع إمكانية ربط أدوات إضافية بقواعد مخصصة.

## أبرز الميزات

- **مكتبة موحدة**: تصفح مهارات النظام والمشاريع حسب التطبيق أو المشروع دون تكرار المجلدات المشتركة.
- **معاينة غنية**: راجع `SKILL.md` وMarkdown والبرامج النصية والصور والملفات النصية والبيانات الوصفية قبل التنفيذ.
- **نقل بين التطبيقات**: أضف مهارة أو أزلها من التطبيقات المدعومة على مستوى النظام أو المشروع.
- **سوق المهارات**: ابحث وعاين وثبّت من المصادر الرسمية والمنتقاة ومصادر المجتمع في مكان واحد.
- **اكتشاف مرن**: سجّل المشاريع وأضف مواقع المسح وأنشئ قواعد مخصصة لمجلدات التطبيقات.
- **حماية محلية**: اعرض المسارات وانسخها، واحصل على تنبيهات للمحتوى الخطر، واحتفظ بنسخ احتياطية عند حذف المهارات.
- **واجهة متعددة اللغات**: الإنجليزية والصينية المبسطة والتقليدية في هونغ كونغ واليابانية والفرنسية والكورية والإسبانية والبرتغالية البرازيلية والعربية.

## لقطات الشاشة

<table>
  <tr>
    <td width="50%"><img src="../images/skill-library.png" alt="مكتبة المهارات" /></td>
    <td width="50%"><img src="../images/skill-market.png" alt="سوق المهارات" /></td>
  </tr>
  <tr>
    <td align="center"><strong>مكتبة المهارات</strong></td>
    <td align="center"><strong>سوق المهارات</strong></td>
  </tr>
</table>

## دعم المنظومة

تغطي القواعد المدمجة أدوات شائعة مثل Codex وDeepSeek Harness وClaude Code وCursor وGemini CLI وGitHub Copilot وOpenCode وOpenClaw وHermes Agent وKilo Code وQoder وQwen Code وTrae وWindsurf. لا تظهر في المكتبة الرئيسية إلا التطبيقات ومواقع المهارات الصالحة المكتشفة على جهازك. ويمكن ربط أدوات أخرى بقواعد مخصصة.

يشمل السوق مصادر Anthropic وOpenAI وOpenClaw وHermes وVercel Labs وHugging Face وNVIDIA وTencent SkillHub وRed Skill وModelScope Skills وClawHub. كما يمكن إضافة مستودعات Git والمجلدات المحلية والمصادر المخصصة المتوافقة.

## البدء

### المتطلبات

- Node.js وnpm
- Git

### التشغيل من المصدر

```bash
git clone https://github.com/Zhiyuan20002/SooKool-Agent-Helper.git
cd SooKool-Agent-Helper
npm install
npm run dev
```

## التطوير

| الأمر               | الوصف                                    |
| ------------------- | ---------------------------------------- |
| `npm run dev`       | تشغيل بيئة تطوير Electron                |
| `npm run typecheck` | فحص أنواع عمليتي التطبيق الرئيسية والعرض |
| `npm test`          | تشغيل الاختبارات الآلية                  |
| `npm run build`     | فحص الأنواع وإنشاء نسخة الإنتاج          |
| `npm run dist:mac`  | حزم تطبيق macOS                          |
| `npm run dist:win`  | حزم تطبيق Windows                        |

يتضمن المستودع أيضًا إعداد حزم Linux في `electron-builder.yml`.

## بنية المشروع

```text
src/main/       عملية Electron الرئيسية واكتشاف المهارات والتخزين والأسواق
src/preload/    جسر منضبط الأنواع بين العملية الرئيسية وعملية العرض
src/renderer/   واجهة React والحالة والترجمة والمعاينات
resources/      أيقونات التطبيق وموارد الحزم
scripts/        التحقق من البناء واختبارات أداء السوق
```

## الأمان

يدير SooKool Agent Helper مواقع المهارات التي يكتشفها أو التي تضبطها صراحة فقط. يلزم اتصال بالشبكة لتحميل الأسواق عبر الإنترنت أو المستودعات البعيدة. راجع دائمًا التحذيرات والبرامج النصية والملفات الثنائية وموثوقية المصدر قبل التثبيت.

يرجى الإبلاغ عن المشكلات الأمنية الحساسة بصورة خاصة لمالك المستودع بدل نشر تفاصيل الاستغلال في Issue عامة.

## المساهمة

نرحب بالـ Issues وPull Requests. عند تعديل الكود:

1. أنشئ Fork للمستودع وفرعًا محدد الهدف.
2. أبقِ التغييرات محدودة وأضف اختبارات عند تغيير السلوك.
3. شغّل `npm run typecheck` و`npm test`.
4. افتح Pull Request يصف المشكلة والحل ونتائج التحقق.

## الترخيص

يصدر SooKool Agent Helper بموجب [ترخيص MIT](../../LICENSE).
