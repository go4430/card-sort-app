import React, { useState } from 'react';
import { ArrowRight } from 'lucide-react';

export default function CardSortApp() {
  const [phase, setPhase] = useState('input');
  const [cardTexts, setCardTexts] = useState([]);
  const [inputText, setInputText] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [categories, setCategories] = useState({
    stronglyDisagree: [],
    disagree: [],
    neutral: [],
    agree: [],
    stronglyAgree: []
  });
  const [subCategories, setSubCategories] = useState({
    '-5': [], '-4': [], '-3': [], '-2': [], '-1': [],
    '0': [],
    '+1': [], '+2': [], '+3': [], '+4': [], '+5': []
  });
  const [currentCardIndex, setCurrentCardIndex] = useState(0);
  const [cardOrder, setCardOrder] = useState([]);
  const [subPhase, setSubPhase] = useState('stronglyAgree');
  const [subCurrentIndex, setSubCurrentIndex] = useState(0);
  const [cards, setCards] = useState(null);
  const [draggedCard, setDraggedCard] = useState(null);
  const [sourceColumn, setSourceColumn] = useState(null);
  const [copySuccess, setCopySuccess] = useState(false);
  const [hoveredCard, setHoveredCard] = useState(null);

  const calculateDistribution = (total) => {
    const labels = ['-5', '-4', '-3', '-2', '-1', '0', '+1', '+2', '+3', '+4', '+5'];
    const numColumns = labels.length;
    
    let distribution = new Array(numColumns).fill(1);
    let remaining = total - numColumns;
    
    const gaussianWeights = labels.map((_, i) => {
      const x = i - 5;
      return Math.exp(-(x * x) / (2 * 2.0 * 2.0));
    });
    
    const sumWeights = gaussianWeights.reduce((a, b) => a + b, 0);
    const additionalCards = gaussianWeights.map(w => Math.round((w / sumWeights) * remaining));
    
    distribution = distribution.map((base, i) => base + additionalCards[i]);
    
    for (let i = 0; i < 5; i++) {
      const avg = Math.floor((distribution[i] + distribution[10 - i]) / 2);
      distribution[i] = avg;
      distribution[10 - i] = avg;
    }
    
    let currentTotal = distribution.reduce((a, b) => a + b, 0);
    
    while (currentTotal !== total) {
      if (currentTotal < total) {
        distribution[5]++;
        currentTotal++;
      } else {
        if (distribution[5] > 1) {
          distribution[5]--;
          currentTotal--;
        } else {
          for (let i = 4; i >= 0; i--) {
            if (currentTotal < total) {
              distribution[i]++;
              distribution[10 - i]++;
              currentTotal += 2;
            } else if (currentTotal > total && distribution[i] > 1) {
              distribution[i]--;
              distribution[10 - i]--;
              currentTotal -= 2;
            }
            if (currentTotal === total) break;
          }
          if (currentTotal === total) break;
          if (currentTotal < total) {
            distribution[5]++;
            currentTotal++;
          } else if (currentTotal > total && distribution[5] > 1) {
            distribution[5]--;
            currentTotal--;
          }
          break;
        }
      }
    }
    
    return labels.map((label, i) => ({
      label,
      count: distribution[i]
    }));
  };

  const distributeCards = () => {
    const columns = calculateDistribution(cardTexts.length);
    const columnData = {};
    columns.forEach(col => columnData[col.label] = []);
    
    // サブカテゴリーから各列のカード候補を作成（番号付き）
    const cardsByColumn = {};
    Object.keys(subCategories).forEach(key => {
      cardsByColumn[key] = subCategories[key].map((text) => {
        const originalIndex = cardTexts.indexOf(text);
        return { id: originalIndex + 1, text: `${originalIndex + 1}. ${text}`, originalIndex };
      });
    });
    
    // プラス側: k, j, i, h, g の順に+5から配置
    const positiveOrder = [
      ...cardsByColumn['+5'],  // k: より共感できる
      ...cardsByColumn['+4'],  // j: 共感できる
      ...cardsByColumn['+3'],  // i: より共感できる
      ...cardsByColumn['+2'],  // h: 共感できる
      ...cardsByColumn['+1']   // g: やや共感できる
    ];
    
    let positiveIndex = 0;
    const positiveColumns = ['+5', '+4', '+3', '+2', '+1'];
    positiveColumns.forEach(col => {
      const needed = columns.find(c => c.label === col).count;
      for (let i = 0; i < needed && positiveIndex < positiveOrder.length; i++) {
        columnData[col].push(positiveOrder[positiveIndex++]);
      }
    });
    
    // マイナス側: a, b, c, d, e の順に-5から配置
    const negativeOrder = [
      ...cardsByColumn['-5'],  // a: より共感できない
      ...cardsByColumn['-4'],  // b: 共感できない
      ...cardsByColumn['-3'],  // c: より共感できない
      ...cardsByColumn['-2'],  // d: 共感できない
      ...cardsByColumn['-1']   // e: やや共感できない
    ];
    
    let negativeIndex = 0;
    const negativeColumns = ['-5', '-4', '-3', '-2', '-1'];
    negativeColumns.forEach(col => {
      const needed = columns.find(c => c.label === col).count;
      for (let i = 0; i < needed && negativeIndex < negativeOrder.length; i++) {
        columnData[col].push(negativeOrder[negativeIndex++]);
      }
    });
    
    // 中立カードを0から配置
    const neutralCards = cardsByColumn['0'];
    let neutralIndex = 0;
    const needed0 = columns.find(c => c.label === '0').count;
    for (let i = 0; i < needed0 && neutralIndex < neutralCards.length; i++) {
      columnData['0'].push(neutralCards[neutralIndex++]);
    }
    
    // 残った中立カードを+1, -1などの空いている箇所に配置
    const remainingNeutral = neutralCards.slice(neutralIndex);
    let remainingNeutralIndex = 0;
    
    // 0から離れた順に配置（+1, -1, +2, -2...）
    const fillOrder = ['+1', '-1', '+2', '-2', '+3', '-3', '+4', '-4', '+5', '-5'];
    fillOrder.forEach(col => {
      const needed = columns.find(c => c.label === col).count;
      while (columnData[col].length < needed && remainingNeutralIndex < remainingNeutral.length) {
        columnData[col].push(remainingNeutral[remainingNeutralIndex++]);
      }
    });
    
    // それでも余ったカードや不足分を処理
    const allRemaining = [
      ...positiveOrder.slice(positiveIndex),
      ...negativeOrder.slice(negativeIndex),
      ...remainingNeutral.slice(remainingNeutralIndex)
    ];
    
    // シャッフルして残りを配置
    const shuffled = allRemaining.sort(() => Math.random() - 0.5);
    let shuffledIndex = 0;
    
    columns.forEach(col => {
      while (columnData[col.label].length < col.count && shuffledIndex < shuffled.length) {
        columnData[col.label].push(shuffled[shuffledIndex++]);
      }
    });
    
    return columnData;
  };

  const categorizeCard = (category) => {
    const newCategories = { ...categories };
    const actualIndex = cardOrder[currentCardIndex];
    newCategories[category].push(cardTexts[actualIndex]);
    setCategories(newCategories);
    
    if (currentCardIndex < cardTexts.length - 1) {
      setCurrentCardIndex(currentCardIndex + 1);
    } else {
      // 次のサブフェーズを決定
      if (newCategories.stronglyAgree.length > 0) {
        setPhase('subcategorize');
        setSubPhase('stronglyAgree');
        setSubCurrentIndex(0);
      } else if (newCategories.agree.length > 0) {
        setPhase('subcategorize');
        setSubPhase('agree');
        setSubCurrentIndex(0);
      } else if (newCategories.stronglyDisagree.length > 0) {
        setPhase('subcategorize');
        setSubPhase('stronglyDisagree');
        setSubCurrentIndex(0);
      } else if (newCategories.disagree.length > 0) {
        setPhase('subcategorize');
        setSubPhase('disagree');
        setSubCurrentIndex(0);
      } else {
        // すべて中立の場合、直接ソート画面へ
        const newSub = {
          '-5': [], '-4': [], '-3': [], '-2': [], '-1': [],
          '0': newCategories.neutral,
          '+1': [], '+2': [], '+3': [], '+4': [], '+5': []
        };
        setSubCategories(newSub);
        setPhase('sort');
        setCards(distributeCardsFromSubCategories(newSub));
      }
    }
  };

  const goBackFromCategorize = () => {
    if (currentCardIndex > 0) {
      // 一つ前のカードに戻る
      const prevActualIndex = cardOrder[currentCardIndex - 1];
      const prevCategory = Object.keys(categories).find(key => 
        categories[key].includes(cardTexts[prevActualIndex])
      );
      if (prevCategory) {
        const newCategories = { ...categories };
        newCategories[prevCategory] = newCategories[prevCategory].filter(
          text => text !== cardTexts[prevActualIndex]
        );
        setCategories(newCategories);
      }
      setCurrentCardIndex(currentCardIndex - 1);
    } else {
      // 最初のカードの場合は入力画面に戻る
      setPhase('input');
      setCategories({ stronglyDisagree: [], disagree: [], neutral: [], agree: [], stronglyAgree: [] });
      setCurrentCardIndex(0);
      setCardOrder([]);
    }
  };

  const goBackFromSubcategorize = () => {
    if (subCurrentIndex > 0) {
      // 一つ前のカードに戻る
      let currentCards;
      if (subPhase === 'stronglyAgree') {
        currentCards = categories.stronglyAgree;
      } else if (subPhase === 'agree') {
        currentCards = categories.agree;
      } else if (subPhase === 'stronglyDisagree') {
        currentCards = categories.stronglyDisagree;
      } else if (subPhase === 'disagree') {
        currentCards = categories.disagree;
      }
      
      const prevCard = currentCards[subCurrentIndex - 1];
      const prevColumn = Object.keys(subCategories).find(key =>
        subCategories[key].includes(prevCard)
      );
      
      if (prevColumn) {
        const newSubCategories = { ...subCategories };
        newSubCategories[prevColumn] = newSubCategories[prevColumn].filter(
          text => text !== prevCard
        );
        setSubCategories(newSubCategories);
      }
      setSubCurrentIndex(subCurrentIndex - 1);
    } else {
      // 現在のサブフェーズの最初のカードの場合、前のサブフェーズに戻る
      if (subPhase === 'disagree') {
        if (categories.stronglyDisagree.length > 0) {
          setSubPhase('stronglyDisagree');
          setSubCurrentIndex(categories.stronglyDisagree.length - 1);
        } else if (categories.agree.length > 0) {
          setSubPhase('agree');
          setSubCurrentIndex(categories.agree.length - 1);
        } else if (categories.stronglyAgree.length > 0) {
          setSubPhase('stronglyAgree');
          setSubCurrentIndex(categories.stronglyAgree.length - 1);
        } else {
          // 最初のサブフェーズの最初のカードなので、5分類画面に戻る
          setPhase('categorize');
          setCurrentCardIndex(cardTexts.length - 1);
          setSubCategories({ '-5': [], '-4': [], '-3': [], '-2': [], '-1': [], '0': [], '+1': [], '+2': [], '+3': [], '+4': [], '+5': [] });
        }
      } else if (subPhase === 'stronglyDisagree') {
        if (categories.agree.length > 0) {
          setSubPhase('agree');
          setSubCurrentIndex(categories.agree.length - 1);
        } else if (categories.stronglyAgree.length > 0) {
          setSubPhase('stronglyAgree');
          setSubCurrentIndex(categories.stronglyAgree.length - 1);
        } else {
          setPhase('categorize');
          setCurrentCardIndex(cardTexts.length - 1);
          setSubCategories({ '-5': [], '-4': [], '-3': [], '-2': [], '-1': [], '0': [], '+1': [], '+2': [], '+3': [], '+4': [], '+5': [] });
        }
      } else if (subPhase === 'agree') {
        if (categories.stronglyAgree.length > 0) {
          setSubPhase('stronglyAgree');
          setSubCurrentIndex(categories.stronglyAgree.length - 1);
        } else {
          setPhase('categorize');
          setCurrentCardIndex(cardTexts.length - 1);
          setSubCategories({ '-5': [], '-4': [], '-3': [], '-2': [], '-1': [], '0': [], '+1': [], '+2': [], '+3': [], '+4': [], '+5': [] });
        }
      } else if (subPhase === 'stronglyAgree') {
        setPhase('categorize');
        setCurrentCardIndex(cardTexts.length - 1);
        setSubCategories({ '-5': [], '-4': [], '-3': [], '-2': [], '-1': [], '0': [], '+1': [], '+2': [], '+3': [], '+4': [], '+5': [] });
      }
    }
  };

  const subCategorizeCard = (column) => {
    const newSubCategories = { ...subCategories };
    
    let currentCards;
    if (subPhase === 'stronglyAgree') {
      currentCards = categories.stronglyAgree;
    } else if (subPhase === 'agree') {
      currentCards = categories.agree;
    } else if (subPhase === 'stronglyDisagree') {
      currentCards = categories.stronglyDisagree;
    } else if (subPhase === 'disagree') {
      currentCards = categories.disagree;
    }
    
    newSubCategories[column].push(currentCards[subCurrentIndex]);
    setSubCategories(newSubCategories);
    
    if (subCurrentIndex < currentCards.length - 1) {
      setSubCurrentIndex(subCurrentIndex + 1);
    } else {
      // 次のサブフェーズへ
      if (subPhase === 'stronglyAgree' && categories.agree.length > 0) {
        setSubPhase('agree');
        setSubCurrentIndex(0);
      } else if ((subPhase === 'stronglyAgree' || subPhase === 'agree') && categories.stronglyDisagree.length > 0) {
        setSubPhase('stronglyDisagree');
        setSubCurrentIndex(0);
      } else if ((subPhase === 'stronglyAgree' || subPhase === 'agree' || subPhase === 'stronglyDisagree') && categories.disagree.length > 0) {
        setSubPhase('disagree');
        setSubCurrentIndex(0);
      } else {
        // すべての細分類が完了
        const finalSub = { ...newSubCategories };
        finalSub['0'] = categories.neutral;
        setSubCategories(finalSub);
        setPhase('sort');
        setCards(distributeCardsFromSubCategories(finalSub));
      }
    }
  };

  const distributeCardsFromSubCategories = (subCats) => {
    const columns = calculateDistribution(cardTexts.length);
    const columnData = {};
    columns.forEach(col => columnData[col.label] = []);
    
    // サブカテゴリーから各列のカード候補を作成（番号付き）
    const cardsByColumn = {};
    Object.keys(subCats).forEach(key => {
      cardsByColumn[key] = subCats[key].map((text) => {
        const originalIndex = cardTexts.indexOf(text);
        return { id: originalIndex + 1, text: `${originalIndex + 1}. ${text}`, originalIndex };
      });
    });
    
    // プラス側: k, j, i, h, g の順に+5から配置
    const positiveOrder = [
      ...cardsByColumn['+5'],  // k: より共感できる
      ...cardsByColumn['+4'],  // j: 共感できる
      ...cardsByColumn['+3'],  // i: より共感できる
      ...cardsByColumn['+2'],  // h: 共感できる
      ...cardsByColumn['+1']   // g: やや共感できる
    ];
    
    let positiveIndex = 0;
    const positiveColumns = ['+5', '+4', '+3', '+2', '+1'];
    positiveColumns.forEach(col => {
      const needed = columns.find(c => c.label === col).count;
      for (let i = 0; i < needed && positiveIndex < positiveOrder.length; i++) {
        columnData[col].push(positiveOrder[positiveIndex++]);
      }
    });
    
    // マイナス側: a, b, c, d, e の順に-5から配置
    const negativeOrder = [
      ...cardsByColumn['-5'],  // a: より共感できない
      ...cardsByColumn['-4'],  // b: 共感できない
      ...cardsByColumn['-3'],  // c: より共感できない
      ...cardsByColumn['-2'],  // d: 共感できない
      ...cardsByColumn['-1']   // e: やや共感できない
    ];
    
    let negativeIndex = 0;
    const negativeColumns = ['-5', '-4', '-3', '-2', '-1'];
    negativeColumns.forEach(col => {
      const needed = columns.find(c => c.label === col).count;
      for (let i = 0; i < needed && negativeIndex < negativeOrder.length; i++) {
        columnData[col].push(negativeOrder[negativeIndex++]);
      }
    });
    
    // 中立カードを0から配置
    const neutralCards = cardsByColumn['0'];
    let neutralIndex = 0;
    const needed0 = columns.find(c => c.label === '0').count;
    for (let i = 0; i < needed0 && neutralIndex < neutralCards.length; i++) {
      columnData['0'].push(neutralCards[neutralIndex++]);
    }
    
    // 残った中立カードを+1, -1などの空いている箇所に配置
    const remainingNeutral = neutralCards.slice(neutralIndex);
    let remainingNeutralIndex = 0;
    
    // すべてのカードを集める（残りの配置用）
    const allRemaining = [
      ...positiveOrder.slice(positiveIndex),
      ...negativeOrder.slice(negativeIndex),
      ...remainingNeutral
    ];
    
    // シャッフルして残りを配置
    const shuffled = allRemaining.sort(() => Math.random() - 0.5);
    let shuffledIndex = 0;
    
    // すべての列を+5から-5の順で処理
    const allColumns = ['+5', '+4', '+3', '+2', '+1', '0', '-1', '-2', '-3', '-4', '-5'];
    allColumns.forEach(col => {
      const needed = columns.find(c => c.label === col).count;
      while (columnData[col].length < needed && shuffledIndex < shuffled.length) {
        columnData[col].push(shuffled[shuffledIndex++]);
      }
    });
    
    return columnData;
  };

  const handleDragStart = (e, card, column) => {
    setDraggedCard(card);
    setSourceColumn(column);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDropOnColumn = (e, targetColumn) => {
    e.preventDefault();
    
    if (!draggedCard || !sourceColumn) return;
    if (sourceColumn === targetColumn) {
      setDraggedCard(null);
      setSourceColumn(null);
      return;
    }

    const columns = calculateDistribution(cardTexts.length);
    const targetColumnData = columns.find(col => col.label === targetColumn);
    if (cards[targetColumn].length >= targetColumnData.count) {
      setDraggedCard(null);
      setSourceColumn(null);
      return;
    }

    const newCards = { ...cards };
    newCards[sourceColumn] = newCards[sourceColumn].filter(c => c.id !== draggedCard.id);
    newCards[targetColumn] = [...newCards[targetColumn], draggedCard];
    
    setCards(newCards);
    setDraggedCard(null);
    setSourceColumn(null);
  };

  const handleDropOnCard = (e, targetCard, targetColumn) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (!draggedCard || !sourceColumn) return;
    if (draggedCard.id === targetCard.id) return;

    const newCards = { ...cards };
    
    if (sourceColumn === targetColumn) {
      const columnCards = [...newCards[sourceColumn]];
      const draggedIndex = columnCards.findIndex(c => c.id === draggedCard.id);
      const targetIndex = columnCards.findIndex(c => c.id === targetCard.id);
      
      [columnCards[draggedIndex], columnCards[targetIndex]] = [columnCards[targetIndex], columnCards[draggedIndex]];
      
      newCards[sourceColumn] = columnCards;
    } else {
      const sourceCards = [...newCards[sourceColumn]];
      const targetCards = [...newCards[targetColumn]];
      
      const draggedIndex = sourceCards.findIndex(c => c.id === draggedCard.id);
      const targetIndex = targetCards.findIndex(c => c.id === targetCard.id);
      
      sourceCards[draggedIndex] = targetCard;
      targetCards[targetIndex] = draggedCard;
      
      newCards[sourceColumn] = sourceCards;
      newCards[targetColumn] = targetCards;
    }
    
    setCards(newCards);
    setDraggedCard(null);
    setSourceColumn(null);
  };

  const handleReset = () => {
    setPhase('input');
    setCardTexts([]);
    setInputText('');
    setErrorMessage('');
    setCategories({ stronglyDisagree: [], disagree: [], neutral: [], agree: [], stronglyAgree: [] });
    setSubCategories({ '-5': [], '-4': [], '-3': [], '-2': [], '-1': [], '0': [], '+1': [], '+2': [], '+3': [], '+4': [], '+5': [] });
    setCurrentCardIndex(0);
    setCardOrder([]);
    setSubPhase('stronglyAgree');
    setSubCurrentIndex(0);
    setCards(null);
    setCopySuccess(false);
    setHoveredCard(null);
  };

  const copyToClipboard = async () => {
    const columns = calculateDistribution(cardTexts.length);
    const result = [];
    
    columns.forEach(column => {
      const columnCards = cards[column.label];
      columnCards.forEach(card => {
        result.push(card.id);
      });
    });
    
    const resultString = result.join('\t');
    
    try {
      await navigator.clipboard.writeText(resultString);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 3000);
    } catch (err) {
      console.error('コピーに失敗しました:', err);
      const textArea = document.createElement('textarea');
      textArea.value = resultString;
      textArea.style.position = 'fixed';
      textArea.style.left = '-999999px';
      document.body.appendChild(textArea);
      textArea.select();
      try {
        document.execCommand('copy');
        setCopySuccess(true);
        setTimeout(() => setCopySuccess(false), 3000);
      } catch (err2) {
        alert('コピーに失敗しました: ' + resultString);
      }
      document.body.removeChild(textArea);
    }
  };

  if (phase === 'input') {
    const handleTextChange = (e) => {
      setInputText(e.target.value);
      setErrorMessage('');
    };
    
    const processInput = () => {
      const lines = inputText.split('\n').filter(line => line.trim() !== '');
      
      const tooLongLines = [];
      lines.forEach((line, index) => {
        if (line.length > 100) {
          tooLongLines.push(index + 1);
        }
      });
      
      if (tooLongLines.length > 0) {
        setErrorMessage(`${tooLongLines.join(', ')}行目が100文字を超えています`);
        return;
      }
      
      if (lines.length < 30) {
        setErrorMessage(`カードが${lines.length}枚です。30枚以上必要です。`);
        return;
      }
      
      if (lines.length > 60) {
        setErrorMessage(`カードが${lines.length}枚です。60枚以下にしてください。`);
        return;
      }
      
      // カードのランダムな順序を生成
      const randomOrder = Array.from({ length: lines.length }, (_, i) => i).sort(() => Math.random() - 0.5);
      
      setCardTexts(lines);
      setCardOrder(randomOrder);
      setPhase('categorize');
    };
    
    const lineCount = inputText.split('\n').filter(line => line.trim() !== '').length;
    
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-8">
        <div className="max-w-4xl mx-auto">
          <div className="bg-white rounded-lg shadow-lg p-8">
            <h1 className="text-3xl font-bold text-slate-800 mb-2">カード並び替えアプリ</h1>
            <p className="text-slate-600 mb-6">カードのテキストを入力してください（1行1枚、30〜60枚、各行100文字以内）</p>
            
            <div className="mb-4">
              <textarea
                value={inputText}
                onChange={handleTextChange}
                placeholder="各カードのテキストを改行区切りで入力してください"
                className="w-full h-96 px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
              />
            </div>
            
            <div className="mb-4 flex justify-between items-center">
              <div className="text-sm text-slate-600">
                現在のカード数: {lineCount} / 60
              </div>
              {lineCount >= 30 && lineCount <= 60 && (
                <div className="text-sm text-green-600 font-medium">
                  ✓ カード数は適切です
                </div>
              )}
            </div>
            
            {errorMessage && (
              <div className="mb-4 p-3 bg-red-50 border border-red-300 rounded-lg text-red-700 text-sm">
                {errorMessage}
              </div>
            )}
            
            <button
              onClick={processInput}
              disabled={lineCount < 30 || lineCount > 60}
              className="w-full px-6 py-3 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors disabled:bg-slate-300 font-medium flex items-center justify-center gap-2"
            >
              分類を開始 <ArrowRight size={20} />
            </button>
            
            {lineCount < 30 && lineCount > 0 && (
              <p className="text-orange-600 text-sm text-center mt-2">あと{30 - lineCount}枚必要です</p>
            )}
            {lineCount > 60 && (
              <p className="text-orange-600 text-sm text-center mt-2">{lineCount - 60}枚多すぎます</p>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (phase === 'categorize') {
    const progress = ((currentCardIndex / cardTexts.length) * 100).toFixed(0);
    
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-8">
        <div className="bg-white rounded-lg shadow-lg p-8 max-w-3xl w-full">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-2xl font-bold text-slate-800">カードの分類</h2>
            <button
              onClick={goBackFromCategorize}
              className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors text-sm"
            >
              戻る
            </button>
          </div>
          <div className="mb-6">
            <div className="flex justify-between text-sm text-slate-600 mb-2">
              <span>進捗: {currentCardIndex + 1} / {cardTexts.length}</span>
              <span>{progress}%</span>
            </div>
            <div className="w-full bg-slate-200 rounded-full h-2">
              <div className="bg-blue-500 h-2 rounded-full transition-all" style={{ width: `${progress}%` }}></div>
            </div>
          </div>
          
          <div className="bg-slate-50 border-2 border-slate-300 rounded-lg p-6 mb-6 min-h-[150px] flex items-center justify-center">
            <p className="text-lg text-slate-800 text-center">{cardOrder[currentCardIndex] + 1}. {cardTexts[cardOrder[currentCardIndex]]}</p>
          </div>
          
          <div className="grid grid-cols-5 gap-3">
            <button
              onClick={() => categorizeCard('stronglyDisagree')}
              className="px-4 py-4 bg-red-200 text-red-900 rounded-lg hover:bg-red-300 transition-colors font-medium border-2 border-red-400 text-sm"
            >
              共感できない
            </button>
            <button
              onClick={() => categorizeCard('disagree')}
              className="px-4 py-4 bg-red-100 text-red-800 rounded-lg hover:bg-red-200 transition-colors font-medium border-2 border-red-300 text-sm"
            >
              やや共感できない
            </button>
            <button
              onClick={() => categorizeCard('neutral')}
              className="px-4 py-4 bg-gray-100 text-gray-800 rounded-lg hover:bg-gray-200 transition-colors font-medium border-2 border-gray-300 text-sm"
            >
              どちらともいえない／わからない
            </button>
            <button
              onClick={() => categorizeCard('agree')}
              className="px-4 py-4 bg-green-100 text-green-800 rounded-lg hover:bg-green-200 transition-colors font-medium border-2 border-green-300 text-sm"
            >
              やや共感できる
            </button>
            <button
              onClick={() => categorizeCard('stronglyAgree')}
              className="px-4 py-4 bg-green-200 text-green-900 rounded-lg hover:bg-green-300 transition-colors font-medium border-2 border-green-400 text-sm"
            >
              共感できる
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (phase === 'subcategorize') {
    let currentCards, title, options;
    
    if (subPhase === 'stronglyAgree') {
      currentCards = categories.stronglyAgree;
      title = '「共感できる」としたカードをさらに分類';
      options = [
        { label: '共感できる', value: '+4', color: 'bg-green-200 border-green-400 text-green-900' },
        { label: 'より共感できる', value: '+5', color: 'bg-green-300 border-green-500 text-green-900' }
      ];
    } else if (subPhase === 'agree') {
      currentCards = categories.agree;
      title = '「やや共感できる」としたカードをさらに分類';
      options = [
        { label: 'やや共感できる', value: '+1', color: 'bg-green-50 border-green-200 text-green-700' },
        { label: '共感できる', value: '+2', color: 'bg-green-100 border-green-300 text-green-800' },
        { label: 'より共感できる', value: '+3', color: 'bg-green-200 border-green-400 text-green-900' }
      ];
    } else if (subPhase === 'stronglyDisagree') {
      currentCards = categories.stronglyDisagree;
      title = '「共感できない」としたカードをさらに分類';
      options = [
        { label: 'より共感できない', value: '-5', color: 'bg-red-300 border-red-500 text-red-900' },
        { label: '共感できない', value: '-4', color: 'bg-red-200 border-red-400 text-red-900' }
      ];
    } else if (subPhase === 'disagree') {
      currentCards = categories.disagree;
      title = '「やや共感できない」としたカードをさらに分類';
      options = [
        { label: 'より共感できない', value: '-3', color: 'bg-red-200 border-red-400 text-red-900' },
        { label: '共感できない', value: '-2', color: 'bg-red-100 border-red-300 text-red-800' },
        { label: 'やや共感できない', value: '-1', color: 'bg-red-50 border-red-200 text-red-700' }
      ];
    }
    
    const progress = ((subCurrentIndex / currentCards.length) * 100).toFixed(0);
    
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-8">
        <div className="bg-white rounded-lg shadow-lg p-8 max-w-3xl w-full">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-2xl font-bold text-slate-800">{title}</h2>
            <button
              onClick={goBackFromSubcategorize}
              className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors text-sm"
            >
              戻る
            </button>
          </div>
          <div className="mb-6">
            <div className="flex justify-between text-sm text-slate-600 mb-2">
              <span>進捗: {subCurrentIndex + 1} / {currentCards.length}</span>
              <span>{progress}%</span>
            </div>
            <div className="w-full bg-slate-200 rounded-full h-2">
              <div className="bg-blue-500 h-2 rounded-full transition-all" style={{ width: `${progress}%` }}></div>
            </div>
          </div>
          
          <div className="bg-slate-50 border-2 border-slate-300 rounded-lg p-6 mb-6 min-h-[150px] flex items-center justify-center">
            <p className="text-lg text-slate-800 text-center">{cardTexts.indexOf(currentCards[subCurrentIndex]) + 1}. {currentCards[subCurrentIndex]}</p>
          </div>
          
          <div className={`grid gap-4 ${options.length === 2 ? 'grid-cols-2' : 'grid-cols-3'}`}>
            {options.map((option) => (
              <button
                key={option.value}
                onClick={() => subCategorizeCard(option.value)}
                className={`px-6 py-4 rounded-lg hover:opacity-80 transition-colors font-medium border-2 ${option.color}`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const columns = calculateDistribution(cardTexts.length);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-3xl font-bold text-slate-800">カード並び替え</h1>
            <p className="text-slate-600">総カード数: {cardTexts.length}枚</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={copyToClipboard}
              className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors font-medium"
            >
              {copySuccess ? 'コピーしました！' : 'クリップボードにコピー'}
            </button>
            <button
              onClick={handleReset}
              className="px-4 py-2 bg-slate-500 text-white rounded-lg hover:bg-slate-600 transition-colors"
            >
              最初から
            </button>
          </div>
        </div>
        
        <div className="flex gap-2 justify-center">
          {columns.map((column) => (
            <div
              key={column.label}
              className="flex flex-col items-center"
              style={{ width: '90px' }}
            >
              <div
                onDragOver={handleDragOver}
                onDrop={(e) => handleDropOnColumn(e, column.label)}
                className="w-full flex-1 mb-3 relative overflow-visible"
                style={{ minHeight: '500px' }}
              >
                <div className="absolute bottom-0 w-full flex flex-col-reverse gap-1">
                  {cards[column.label].map((card) => (
                    <div
                      key={card.id}
                      className="relative"
                      onMouseEnter={() => setHoveredCard(card.id)}
                      onMouseLeave={() => setHoveredCard(null)}
                    >
                      <div
                        draggable
                        onDragStart={(e) => handleDragStart(e, card, column.label)}
                        onDragOver={handleDragOver}
                        onDrop={(e) => handleDropOnCard(e, card, column.label)}
                        className={`w-full bg-white border-2 border-blue-400 rounded shadow-sm cursor-move hover:shadow-md transition-all flex items-center justify-center p-2 text-xs text-slate-700 ${
                          draggedCard?.id === card.id ? 'opacity-50' : 'opacity-100'
                        }`}
                        style={{
                          backgroundColor: draggedCard?.id === card.id ? '#e0e7ff' : '#ffffff',
                          height: '70px',
                          width: '100%'
                        }}
                      >
                        <div style={{
                          display: '-webkit-box',
                          WebkitLineClamp: 3,
                          WebkitBoxOrient: 'vertical',
                          overflow: 'hidden',
                          textAlign: 'center',
                          width: '100%'
                        }}>
                          {card.text}
                        </div>
                      </div>
                      {hoveredCard === card.id && (
                        <div 
                          className="absolute bottom-full left-1/2 mb-2 px-4 py-3 bg-gray-900 text-white text-sm rounded shadow-lg z-50"
                          style={{
                            transform: 'translateX(-50%)',
                            minWidth: '200px',
                            maxWidth: '400px',
                            pointerEvents: 'none',
                            whiteSpace: 'normal',
                            wordWrap: 'break-word'
                          }}
                        >
                          {card.text}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
              
              <div className="text-center">
                <div 
                  className="text-sm font-bold text-slate-700 px-3 py-1 rounded"
                  style={{
                    backgroundColor: 
                      column.label === '+5' ? '#bbf7d0' :
                      column.label === '+4' ? '#d9f99d' :
                      column.label === '+3' ? '#ecfccb' :
                      column.label === '+2' ? '#f7fee7' :
                      column.label === '+1' ? '#fefce8' :
                      column.label === '-1' ? '#fef2f2' :
                      column.label === '-2' ? '#fee2e2' :
                      column.label === '-3' ? '#fecaca' :
                      column.label === '-4' ? '#fca5a5' :
                      column.label === '-5' ? '#f87171' :
                      '#e5e7eb'
                  }}
                >
                  {column.label}
                </div>
              </div>
            </div>
          ))}
        </div>
        
        <div className="flex justify-between mt-4 px-4">
          <div className="text-base text-slate-600 font-medium">←最も共感できない</div>
          <div className="text-base text-slate-600 font-medium">どちらともいえない／わからない</div>
          <div className="text-base text-slate-600 font-medium">最も共感できる→</div>
        </div>
      </div>
    </div>
  );
}
