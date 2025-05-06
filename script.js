document.addEventListener('DOMContentLoaded', function() {
    // DOM要素の参照を取得
    const sealInput = document.getElementById('sealInput');
    const fileName = document.getElementById('file-name');
    const processButton = document.getElementById('processButton');
    const downloadButton = document.getElementById('downloadButton');
    const downloadZipButton = document.getElementById('downloadZipButton');
    const thresholdSlider = document.getElementById('threshold');
    const thresholdValue = document.getElementById('threshold-value');
    const sealColorSelect = document.getElementById('sealColor');
    const customColorInput = document.getElementById('customColor');
    const qualitySelect = document.getElementById('quality');
    const loadingElement = document.getElementById('loading');
    const container = document.querySelector('.container');
    const appContainer = document.getElementById('app-container');
    const opencvLoading = document.getElementById('opencv-loading');
    const detectMultipleCheckbox = document.getElementById('detectMultiple');
    const resizeImageCheckbox = document.getElementById('resizeImage');
    const multiSealsContainer = document.getElementById('multi-seals-container');
    const sealsPreview = document.getElementById('seals-preview');
    const sealCountSpan = document.getElementById('seal-count');
    const cameraButton = document.getElementById('cameraButton');

    // カメラ撮影プレビュー用のコンテナ作成
    const capturedImageContainer = document.createElement('div');
    capturedImageContainer.className = 'captured-image-container';
    capturedImageContainer.style.display = 'none';
    capturedImageContainer.style.marginTop = '15px';
    capturedImageContainer.style.textAlign = 'center';
    
    // 撮影画像表示用の要素
    const capturedImage = document.createElement('img');
    capturedImage.style.maxWidth = '100%';
    capturedImage.style.maxHeight = '300px';
    capturedImage.style.border = '1px solid #ccc';
    capturedImage.style.borderRadius = '4px';
    capturedImageContainer.appendChild(capturedImage);
    
    // 撮影画像タイトル
    const capturedImageTitle = document.createElement('p');
    capturedImageTitle.textContent = '撮影した画像';
    capturedImageTitle.style.marginTop = '5px';
    capturedImageTitle.style.fontWeight = 'bold';
    capturedImageContainer.appendChild(capturedImageTitle);
    
    // アップロードエリアの後にコンテナを追加
    const uploadArea = sealInput.closest('.upload-area') || sealInput.parentElement;
    uploadArea.after(capturedImageContainer);

    // カメラ撮影用のモーダルを作成
    const cameraModal = document.createElement('div');
    cameraModal.className = 'camera-modal';
    cameraModal.style.display = 'none';
    cameraModal.style.position = 'fixed';
    cameraModal.style.top = '0';
    cameraModal.style.left = '0';
    cameraModal.style.width = '100%';
    cameraModal.style.height = '100%';
    cameraModal.style.backgroundColor = 'rgba(0,0,0,0.8)';
    cameraModal.style.zIndex = '1000';
    cameraModal.style.display = 'flex';
    cameraModal.style.flexDirection = 'column';
    cameraModal.style.alignItems = 'center';
    cameraModal.style.justifyContent = 'center';
    cameraModal.style.display = 'none';
    
    // ビデオ要素を作成
    const video = document.createElement('video');
    video.style.maxWidth = '100%';
    video.style.maxHeight = '70vh';
    video.style.marginBottom = '20px';
    video.autoplay = true;
    video.playsInline = true; // iOSで自動再生のために必要
    cameraModal.appendChild(video);
    
    // キャンバス要素を作成 (撮影した画像を一時的に保持するため)
    const canvas = document.createElement('canvas');
    canvas.style.display = 'none';
    cameraModal.appendChild(canvas);
    
    // ボタンコンテナを作成
    const buttonContainer = document.createElement('div');
    buttonContainer.style.display = 'flex';
    buttonContainer.style.gap = '10px';
    cameraModal.appendChild(buttonContainer);
    
    // 撮影ボタンを作成
    const captureButton = document.createElement('button');
    captureButton.textContent = '撮影する';
    captureButton.style.padding = '10px 20px';
    captureButton.style.margin = '10px';
    buttonContainer.appendChild(captureButton);
    
    // キャンセルボタンを作成
    const cancelButton = document.createElement('button');
    cancelButton.textContent = 'キャンセル';
    cancelButton.style.padding = '10px 20px';
    cancelButton.style.margin = '10px';
    buttonContainer.appendChild(cancelButton);
    
    // ドキュメントにモーダルを追加
    document.body.appendChild(cameraModal);
    
    // メディアストリーム参照を保持
    let mediaStream = null;

    // 選択された画像ファイル
    let selectedFile = null;
    // 処理後の画像データURL
    let processedImageDataURL = null;
    // 検出された複数の印鑑データ
    let detectedSeals = [];
    // 画像処理の最大サイズ
    const MAX_IMAGE_SIZE = 1500;

    // 画面のサイズに合わせてレイアウトを調整
    function adjustLayout() {
        // ウィンドウの内部高さを取得
        const windowHeight = window.innerHeight;
        const windowWidth = window.innerWidth;
        
        // iOS Safariのための特別な対応
        const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
        
        if (isIOS) {
            // ビューポートの絶対的な高さを設定（アドレスバーなどを考慮）
            document.documentElement.style.height = `${windowHeight}px`;
            document.body.style.height = `${windowHeight}px`;
        }

        // アプリコンテナの高さを設定
        appContainer.style.minHeight = `${windowHeight}px`;
        appContainer.style.height = `${windowHeight}px`;
        
        // OpenCVローディング画面の高さも設定
        opencvLoading.style.height = `${windowHeight}px`;
        
        // ボタンエリアのレイアウト調整（画面幅によって分岐）
        const buttonArea = document.querySelector('.button-area');
        if (windowWidth <= 480) {
            buttonArea.style.flexDirection = 'column';
            buttonArea.querySelectorAll('button').forEach(button => {
                button.style.width = '100%';
                button.style.margin = '5px 0';
            });
        } else {
            buttonArea.style.flexDirection = 'row';
            buttonArea.querySelectorAll('button').forEach(button => {
                button.style.width = 'auto';
                button.style.margin = '0 10px 10px';
            });
        }
    }

    // 初期レイアウト調整
    adjustLayout();
    
    // ウィンドウのリサイズ時とorientationchangeイベント時にレイアウトを再調整
    window.addEventListener('resize', adjustLayout);
    window.addEventListener('orientationchange', function() {
        // 向き変更後に少し遅延させて調整（iOS対策）
        setTimeout(adjustLayout, 100);
    });
    
    // OpenCVが読み込まれた時のコールバック関数を上書き
    window.onOpenCvReady = function() {
        console.log('OpenCV.js is ready.');
        opencvLoading.style.display = 'none';
        appContainer.style.display = 'block';
        // OpenCV読み込み完了後にもレイアウトを調整
        setTimeout(adjustLayout, 100);
    };

    // カメラボタンのクリックイベント
    cameraButton.addEventListener('click', async function() {
        try {
            // ユーザーのメディアデバイスにアクセス
            mediaStream = await navigator.mediaDevices.getUserMedia({ 
                video: { facingMode: 'environment' }, // 背面カメラを優先
                audio: false 
            });
            
            // ビデオ要素にストリームを設定
            video.srcObject = mediaStream;
            
            // モーダルを表示
            cameraModal.style.display = 'flex';
        } catch (error) {
            console.error('カメラへのアクセスができませんでした:', error);
            alert('カメラへのアクセスができませんでした。設定を確認してください。');
        }
    });
    
    // 撮影ボタンのクリックイベント
    captureButton.addEventListener('click', function() {
        // キャンバスを設定
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext('2d');
        
        // ビデオの現在のフレームをキャンバスに描画
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        
        // キャンバスから画像データを取得
        const imageDataURL = canvas.toDataURL('image/png');
        
        // 画像データをBlobに変換
        fetch(imageDataURL)
            .then(res => res.blob())
            .then(blob => {
                // ファイル名を設定
                const now = new Date();
                const fileName = `camera_${now.getFullYear()}${(now.getMonth()+1).toString().padStart(2, '0')}${now.getDate().toString().padStart(2, '0')}_${now.getHours().toString().padStart(2, '0')}${now.getMinutes().toString().padStart(2, '0')}${now.getSeconds().toString().padStart(2, '0')}.png`;
                
                // Blobからファイルオブジェクトを作成
                selectedFile = new File([blob], fileName, { type: 'image/png' });
                
                // ファイル名表示を更新
                document.getElementById('file-name').textContent = fileName;
                
                // 撮影画像を表示
                capturedImage.src = imageDataURL;
                capturedImageContainer.style.display = 'block';
                
                // 処理ボタンを有効化
                processButton.disabled = false;
                
                // カメラモーダルを閉じる
                closeCamera();
            });
    });
    
    // キャンセルボタンのクリックイベント
    cancelButton.addEventListener('click', function() {
        closeCamera();
    });
    
    // カメラを閉じる関数
    function closeCamera() {
        // モーダルを非表示
        cameraModal.style.display = 'none';
        
        // メディアストリームを停止
        if (mediaStream) {
            mediaStream.getTracks().forEach(track => track.stop());
            mediaStream = null;
        }
        
        // ビデオのソースをクリア
        video.srcObject = null;
    }

    // ファイル選択時の処理
    sealInput.addEventListener('change', function(e) {
        const file = e.target.files[0];
        if (!file) return;

        selectedFile = file;
        fileName.textContent = file.name;
        
        // 前回の撮影画像を非表示
        capturedImageContainer.style.display = 'none';
        
        // 処理ボタンを有効化
        processButton.disabled = false;
        
        // 以前の処理結果をリセット
        downloadButton.disabled = true;
        downloadZipButton.disabled = true;
        processedImageDataURL = null;
        clearDetectedSeals();
    });

    // しきい値スライダーの値表示
    thresholdSlider.addEventListener('input', function() {
        thresholdValue.textContent = this.value;
    });

    // カスタムカラー選択の表示/非表示
    sealColorSelect.addEventListener('change', function() {
        customColorInput.style.display = this.value === 'custom' ? 'inline-block' : 'none';
    });

    // 処理ボタンのクリック時
    processButton.addEventListener('click', function() {
        if (!selectedFile) return;
        
        // OpenCVが読み込まれているか確認
        if (typeof cv === 'undefined') {
            alert('画像処理ライブラリがまだ読み込まれていません。しばらくお待ちください。');
            return;
        }
        
        // 撮影画像表示を非表示
        capturedImageContainer.style.display = 'none';
        
        // ローディング表示を開始
        loadingElement.style.display = 'flex';
        
        const threshold = parseInt(thresholdSlider.value);
        const colorOption = sealColorSelect.value;
        const quality = parseFloat(qualitySelect.value);
        const detectMultiple = detectMultipleCheckbox.checked;
        const resizeImage = resizeImageCheckbox.checked;
        
        // 選択された印影の色を取得
        let sealColor;
        switch (colorOption) {
            case 'red':
                sealColor = { r: 255, g: 0, b: 0 };
                break;
            case 'black':
                sealColor = { r: 0, g: 0, b: 0 };
                break;
            case 'blue':
                sealColor = { r: 0, g: 0, b: 255 };
                break;
            case 'custom':
                // カスタムカラーをRGB形式に変換
                const hex = customColorInput.value.substring(1); // '#FF0000' → 'FF0000'
                sealColor = {
                    r: parseInt(hex.substring(0, 2), 16),
                    g: parseInt(hex.substring(2, 4), 16),
                    b: parseInt(hex.substring(4, 6), 16)
                };
                break;
            default:
                sealColor = { r: 255, g: 0, b: 0 };
        }
        
        // 非同期で画像処理を実行（UIをブロックしないため）
        setTimeout(() => {
            if (detectMultiple) {
                processImageWithOpenCV(selectedFile, threshold, sealColor, quality, resizeImage, true);
            } else {
                processImageWithOpenCV(selectedFile, threshold, sealColor, quality, resizeImage, false);
            }
        }, 100);
    });

    // 単一印鑑ダウンロードボタンのクリック時
    downloadButton.addEventListener('click', function() {
        if (!processedImageDataURL) return;
        
        // ダウンロードリンクを作成
        const link = document.createElement('a');
        link.href = processedImageDataURL;
        link.download = 'kouin_' + selectedFile.name.replace(/\.[^/.]+$/, "") + '.png';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    });

    // ZIP一括ダウンロードボタンのクリック時
    downloadZipButton.addEventListener('click', function() {
        if (detectedSeals.length === 0) return;
        
        // 選択された印鑑のみ取得
        const selectedSeals = detectedSeals.filter(seal => seal.selected);
        
        if (selectedSeals.length === 0) {
            alert('ダウンロードする印鑑を選択してください');
            return;
        }
        
        // ダウンロード中表示
        loadingElement.style.display = 'flex';
        loadingElement.querySelector('p').textContent = 'ZIP作成中...';
        
        // 非同期でZIPファイルを作成
        setTimeout(() => {
            createAndDownloadZip(selectedSeals);
        }, 100);
    });

    // ZIPファイルを作成してダウンロード
    function createAndDownloadZip(seals) {
        try {
            // 新しいJSZipインスタンスを作成
            const zip = new JSZip();
            
            // 各印鑑データをZIPに追加
            for (let i = 0; i < seals.length; i++) {
                const seal = seals[i];
                const dataURL = seal.dataURL;
                
                // Data URLからバイナリデータを抽出
                const base64Data = dataURL.split(',')[1];
                const binaryData = atob(base64Data);
                
                // バイナリデータをArrayBufferに変換
                const arrayBuffer = new ArrayBuffer(binaryData.length);
                const view = new Uint8Array(arrayBuffer);
                for (let j = 0; j < binaryData.length; j++) {
                    view[j] = binaryData.charCodeAt(j);
                }
                
                // ZIPファイルに追加
                zip.file(`kouin_${i+1}.png`, arrayBuffer, {binary: true});
            }
            
            // ZIPファイルを生成してダウンロード
            zip.generateAsync({type: 'blob'}).then(function(content) {
                // ファイル名を設定
                const zipFileName = `kouin_${selectedFile.name.replace(/\.[^/.]+$/, "")}_${seals.length}seals.zip`;
                
                // FileSaver.jsを使用してダウンロード
                saveAs(content, zipFileName);
                
                // ローディング表示を終了
                loadingElement.style.display = 'none';
                loadingElement.querySelector('p').textContent = '処理中...';
            });
        } catch (error) {
            console.error('ZIPファイル作成中にエラーが発生しました:', error);
            alert('ZIPファイル作成中にエラーが発生しました。');
            loadingElement.style.display = 'none';
            loadingElement.querySelector('p').textContent = '処理中...';
        }
    }

    // 検出された印鑑表示をクリア
    function clearDetectedSeals() {
        detectedSeals = [];
        sealsPreview.innerHTML = '';
        sealCountSpan.textContent = '0';
        multiSealsContainer.style.display = 'none';
        
        // レイアウトを再調整
        setTimeout(adjustLayout, 100);
    }

    // 検出された印鑑を表示
    function displayDetectedSeals() {
        // コンテナをクリア
        sealsPreview.innerHTML = '';
        
        // 印鑑の数を表示
        sealCountSpan.textContent = detectedSeals.length;
        
        // 印鑑が1つ以上検出された場合のみ表示
        if (detectedSeals.length > 0) {
            multiSealsContainer.style.display = 'block';
            
            // 各印鑑の表示要素を作成
            detectedSeals.forEach((seal, index) => {
                const sealItem = document.createElement('div');
                sealItem.className = 'seal-item';
                
                // プレビュー画像
                const sealPreview = document.createElement('div');
                sealPreview.className = 'seal-preview';
                
                const img = document.createElement('img');
                img.src = seal.dataURL;
                img.alt = `印鑑 ${index + 1}`;
                
                sealPreview.appendChild(img);
                sealItem.appendChild(sealPreview);
                
                // チェックボックス
                const checkbox = document.createElement('input');
                checkbox.type = 'checkbox';
                checkbox.className = 'seal-checkbox';
                checkbox.checked = seal.selected;
                checkbox.id = `seal-checkbox-${index}`;
                
                checkbox.addEventListener('change', function() {
                    seal.selected = this.checked;
                    // ZIP一括ダウンロードボタンの有効/無効を更新
                    const anySelected = detectedSeals.some(s => s.selected);
                    downloadZipButton.disabled = !anySelected;
                });
                
                const label = document.createElement('label');
                label.htmlFor = `seal-checkbox-${index}`;
                label.textContent = `印鑑 ${index + 1}`;
                
                sealItem.appendChild(checkbox);
                sealItem.appendChild(label);
                
                sealsPreview.appendChild(sealItem);
            });
            
            // ZIP一括ダウンロードボタンを有効化
            downloadZipButton.disabled = false;
            
            // 印鑑が表示されたらレイアウトを再調整
            setTimeout(adjustLayout, 100);
        } else {
            multiSealsContainer.style.display = 'none';
            downloadZipButton.disabled = true;
        }
    }

    // 画像をOpenCVのMat形式に変換
    function imgToMat(img) {
        // イメージをキャンバスに描画
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        ctx.drawImage(img, 0, 0);
        
        // キャンバスからデータを取得
        const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        
        // OpenCVのMatに変換
        return cv.matFromImageData(imgData);
    }

    // Matをリサイズして返す
    function resizeMat(mat, maxSize) {
        const width = mat.cols;
        const height = mat.rows;
        
        // リサイズが必要な場合
        if (width > maxSize || height > maxSize) {
            // アスペクト比を維持するための係数を計算
            const scaleFactor = maxSize / Math.max(width, height);
            const newWidth = Math.round(width * scaleFactor);
            const newHeight = Math.round(height * scaleFactor);
            
            // 新しいサイズのMatを作成
            const resizedMat = new cv.Mat();
            const dsize = new cv.Size(newWidth, newHeight);
            
            // リサイズを実行
            cv.resize(mat, resizedMat, dsize, 0, 0, cv.INTER_AREA);
            
            return resizedMat;
        }
        
        // リサイズが不要な場合は元のMatをクローン
        return mat.clone();
    }

    // OpenCVを使った画像処理
    function processImageWithOpenCV(file, threshold, sealColor, quality, shouldResize, detectMultiple) {
        try {
            // FileReaderでファイルを読み込む
            const reader = new FileReader();
            
            reader.onload = function(event) {
                // 画像要素を作成
                const img = new Image();
                
                img.onload = function() {
                    // 画像をMatに変換
                    const srcMat = imgToMat(img);
                    
                    // 必要に応じてリサイズ
                    const processMat = shouldResize ? resizeMat(srcMat, MAX_IMAGE_SIZE) : srcMat.clone();
                    
                    // グレースケールに変換
                    const grayMat = new cv.Mat();
                    cv.cvtColor(processMat, grayMat, cv.COLOR_RGBA2GRAY);
                    
                    // しきい値処理
                    const thresholdMat = new cv.Mat();
                    cv.threshold(grayMat, thresholdMat, threshold, 255, cv.THRESH_BINARY_INV);
                    
                    if (detectMultiple) {
                        // 複数印鑑検出処理
                        processMultipleSeals(processMat, thresholdMat, sealColor, quality);
                    } else {
                        // 単一印鑑処理
                        processSingleSeal(processMat, thresholdMat, sealColor, quality);
                    }
                    
                    // メモリ解放
                    srcMat.delete();
                    processMat.delete();
                    grayMat.delete();
                    thresholdMat.delete();
                };
                
                // データURLを画像にセット
                img.src = event.target.result;
            };
            
            // ファイルをデータURLとして読み込む
            reader.readAsDataURL(file);
            
        } catch (error) {
            console.error('OpenCVによる画像処理中にエラーが発生しました:', error);
            alert('画像処理中にエラーが発生しました。別の画像を試してください。');
            loadingElement.style.display = 'none';
        }
    }

    // 単一印鑑の処理
    function processSingleSeal(srcMat, binaryMat, sealColor, quality) {
        try {
            // 画像のサイズ
            const width = srcMat.cols;
            const height = srcMat.rows;
            
            // 処理結果を保存するMat
            const resultMat = new cv.Mat.zeros(height, width, cv.CV_8UC4);
            
            // バウンディングボックスを見つける
            let minX = width;
            let minY = height;
            let maxX = 0;
            let maxY = 0;
            
            // しきい値マスクを使って印鑑部分を抽出
            for (let y = 0; y < height; y++) {
                for (let x = 0; x < width; x++) {
                    // バイナリマスクの値を取得
                    const maskValue = binaryMat.ucharPtr(y, x)[0];
                    
                    if (maskValue > 0) {  // 印鑑部分
                        // バウンディングボックスを更新
                        minX = Math.min(minX, x);
                        minY = Math.min(minY, y);
                        maxX = Math.max(maxX, x);
                        maxY = Math.max(maxY, y);
                        
                        // 結果に色を設定
                        const rgba = resultMat.ucharPtr(y, x);
                        rgba[0] = sealColor.r;  // R
                        rgba[1] = sealColor.g;  // G
                        rgba[2] = sealColor.b;  // B
                        rgba[3] = 255;          // A
                    }
                }
            }
            
            // バウンディングボックスが見つかった場合
            if (minX < maxX && minY < maxY) {
                // パディングを追加
                const padding = 10;
                minX = Math.max(0, minX - padding);
                minY = Math.max(0, minY - padding);
                maxX = Math.min(width - 1, maxX + padding);
                maxY = Math.min(height - 1, maxY + padding);
                
                // トリミング領域
                const rectWidth = maxX - minX + 1;
                const rectHeight = maxY - minY + 1;
                
                // トリミング領域を抽出
                const roi = new cv.Rect(minX, minY, rectWidth, rectHeight);
                const croppedMat = resultMat.roi(roi);
                
                // 結果をキャンバスに描画してデータURLを取得
                const canvas = document.createElement('canvas');
                canvas.width = rectWidth;
                canvas.height = rectHeight;
                cv.imshow(canvas, croppedMat);
                processedImageDataURL = canvas.toDataURL('image/png', quality);
                
                // ダウンロードボタンを有効化
                downloadButton.disabled = false;
                
                // 単一印鑑として検出結果を更新
                clearDetectedSeals();
                detectedSeals.push({
                    dataURL: processedImageDataURL,
                    width: rectWidth,
                    height: rectHeight,
                    selected: true
                });
                displayDetectedSeals();
                
                // メモリ解放
                croppedMat.delete();
            } else {
                // 印鑑領域が見つからなかった場合
                alert('印鑑領域が検出できませんでした。しきい値を調整してください。');
            }
            
            // メモリ解放
            resultMat.delete();
            
        } catch (error) {
            console.error('単一印鑑処理中にエラーが発生しました:', error);
            throw error;
        } finally {
            // ローディング表示を終了
            loadingElement.style.display = 'none';
            
            // レイアウトを再調整
            setTimeout(adjustLayout, 100);
        }
    }

    // 複数印鑑の処理
    function processMultipleSeals(srcMat, binaryMat, sealColor, quality) {
        try {
            // 輪郭検出のための一時データ
            const contours = new cv.MatVector();
            const hierarchy = new cv.Mat();
            
            // 輪郭の検出
            cv.findContours(binaryMat, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);
            
            // 検出された印鑑をクリア
            clearDetectedSeals();
            
            // 輪郭ごとに処理
            for (let i = 0; i < contours.size(); i++) {
                const contour = contours.get(i);
                const area = cv.contourArea(contour);
                
                // 小さすぎる輪郭は無視（ノイズ除去）
                const minArea = 500;  // 最小面積
                if (area < minArea) {
                    continue;
                }
                
                // 輪郭を囲む矩形を取得
                const rect = cv.boundingRect(contour);
                
                // パディングを追加
                const padding = 10;
                const x = Math.max(0, rect.x - padding);
                const y = Math.max(0, rect.y - padding);
                const width = Math.min(srcMat.cols - x, rect.width + padding * 2);
                const height = Math.min(srcMat.rows - y, rect.height + padding * 2);
                
                // 切り抜き領域が有効か確認
                if (width <= 0 || height <= 0) {
                    continue;
                }
                
                // 処理結果を保存するMat
                const resultMat = new cv.Mat.zeros(height, width, cv.CV_8UC4);
                
                // 元画像から切り抜き領域を取得
                const roi = new cv.Rect(x, y, width, height);
                const roiMat = srcMat.roi(roi);
                
                // バイナリマスクから同じ領域を切り抜く
                const maskRoi = binaryMat.roi(roi);
                
                // マスクを使って色を設定
                for (let y = 0; y < height; y++) {
                    for (let x = 0; x < width; x++) {
                        // マスク値を取得
                        const maskValue = maskRoi.ucharPtr(y, x)[0];
                        
                        if (maskValue > 0) {  // 印鑑部分
                            // 結果に色を設定
                            const rgba = resultMat.ucharPtr(y, x);
                            rgba[0] = sealColor.r;  // R
                            rgba[1] = sealColor.g;  // G
                            rgba[2] = sealColor.b;  // B
                            rgba[3] = 255;          // A
                        }
                    }
                }
                
                // 結果をキャンバスに描画してデータURLを取得
                const canvas = document.createElement('canvas');
                canvas.width = width;
                canvas.height = height;
                cv.imshow(canvas, resultMat);
                const sealDataURL = canvas.toDataURL('image/png', quality);
                
                // 検出された印鑑リストに追加
                detectedSeals.push({
                    dataURL: sealDataURL,
                    width: width,
                    height: height,
                    selected: true
                });
                
                // メモリ解放
                roiMat.delete();
                maskRoi.delete();
                resultMat.delete();
            }
            
            // メモリ解放
            contours.delete();
            hierarchy.delete();
            
            // 印鑑が見つからなかった場合、単一印鑑処理を試す
            if (detectedSeals.length === 0) {
                processSingleSeal(srcMat, binaryMat, sealColor, quality);
                return;
            }
            
            // 検出された印鑑を表示
            displayDetectedSeals();
            
            // 最初の印鑑を処理結果として設定
            if (detectedSeals.length > 0) {
                processedImageDataURL = detectedSeals[0].dataURL;
                downloadButton.disabled = false;
            }
            
        } catch (error) {
            console.error('複数印鑑処理中にエラーが発生しました:', error);
            // エラー時は単一印鑑処理を試みる
            processSingleSeal(srcMat, binaryMat, sealColor, quality);
        } finally {
            // ローディング表示を終了
            loadingElement.style.display = 'none';
            
            // レイアウトを再調整
            setTimeout(adjustLayout, 100);
        }
    }
}); 