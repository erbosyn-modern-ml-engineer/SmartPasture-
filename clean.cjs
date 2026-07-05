const fs = require('fs');
const file = 'c:/Users/erbos/Downloads/SmartPastureAPP/src/i18n/translations.ts';
let content = fs.readFileSync(file, 'utf8');

// Remove demo keys
content = content.replace(/^\s*'demo\..*$/gm, '');
// Remove scenario.assumption.confidenceDemo
content = content.replace(/^\s*'scenario\.assumption\.confidenceDemo.*$/gm, '');

// Rename 'жюри' and 'FAQ для жюри'
content = content.replace(/('knowledge\.faqTitle':\s*)'.*?'(,?)/g, "$1'FAQ'$2");
content = content.replace(/('knowledge\.faqSub':\s*)'.*?'(,?)/g, "$1'Жүйе қалай жұмыс істейді'$2");
content = content.replace(/('knowledge\.scoringSub':\s*)'.*?'(,?)/g, "$1'Scoring логикасы'$2");
content = content.replace(/('knowledge\.systemSub':\s*)'.*?'(,?)/g, "$1'SmartPasture жұмыс келісімі'$2");

// Replace ru specific text
content = content.replace(/'FAQ для жюри'/g, "'FAQ'");
content = content.replace(/'Почему это не fake AI и зачем нужен scenario mode\.'/g, "'Как работает система.'");
content = content.replace(/'Достаточно прозрачно для жюри, но не перегружено как научная статья\.'/g, "'Прозрачная логика оценки.'");
content = content.replace(/'Честный operating contract SmartPasture\.'/g, "'Рабочий контракт SmartPasture.'");
content = content.replace(/'Жюриге арналған FAQ'/g, "'FAQ'");

fs.writeFileSync(file, content, 'utf8');
console.log('Translations cleaned.');
