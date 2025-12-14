const fs = require('fs');
const path = require('path');

const textDir = path.join(__dirname, '../public/data/text');
const outputFile = path.join(__dirname, '../public/data/text-list.json');

// 学年フォルダの順序
const gradeOrder = ['1年生', '2年生', '3年生', '4年生', '5年生', '6年生'];

function getTextFiles(gradeFolder) {
  const gradePath = path.join(textDir, gradeFolder);
  if (!fs.existsSync(gradePath)) {
    return [];
  }

  const files = fs.readdirSync(gradePath);
  return files
    .filter(file => file.endsWith('.txt'))
    .map(file => {
      // ファイル名から拡張子を除いてラベルを生成
      const label = file.replace('.txt', '');
      return {
        filename: file,
        label: label
      };
    })
    .sort((a, b) => a.filename.localeCompare(b.filename, 'ja'));
}

function generateTextList() {
  const grades = gradeOrder.map(gradeFolder => {
    const stories = getTextFiles(gradeFolder);
    return {
      folder: gradeFolder,
      label: gradeFolder,
      stories: stories
    };
  });

  const data = { grades };
  
  fs.writeFileSync(outputFile, JSON.stringify(data, null, 2), 'utf8');
  console.log(`✅ ファイル一覧を生成しました: ${outputFile}`);
  console.log(`   学年数: ${grades.length}`);
  console.log(`   総文章数: ${grades.reduce((sum, g) => sum + g.stories.length, 0)}`);
}

// 実行
try {
  generateTextList();
} catch (error) {
  console.error('❌ エラーが発生しました:', error);
  process.exit(1);
}

