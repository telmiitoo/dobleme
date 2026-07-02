document.addEventListener('DOMContentLoaded', () => {

    /* ==========================================================================
       1. STICKY HEADER & MOBILE NAVIGATION MENU
       ========================================================================== */
    const header = document.getElementById('main-header');
    const menuToggle = document.getElementById('menu-toggle');
    const navMenu = document.getElementById('navigation-menu');
    const navLinks = document.querySelectorAll('.nav-link');

    // Toggle header style on scroll
    window.addEventListener('scroll', () => {
        if (window.scrollY > 50) {
            header.classList.add('scrolled');
        } else {
            header.classList.remove('scrolled');
        }
    });

    // Mobile Menu Toggle
    menuToggle.addEventListener('click', () => {
        menuToggle.classList.toggle('active');
        navMenu.classList.toggle('active');
    });

    // Close menu when links are clicked
    navLinks.forEach(link => {
        link.addEventListener('click', () => {
            menuToggle.classList.remove('active');
            navMenu.classList.remove('active');
        });
    });

    // Intersection Observer to update active navigation links on scroll
    const sections = document.querySelectorAll('section');
    const observerOptions = {
        root: null,
        rootMargin: '-20% 0px -60% 0px',
        threshold: 0
    };

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const id = entry.target.getAttribute('id');
                navLinks.forEach(link => {
                    link.classList.remove('active');
                    if (link.getAttribute('href') === `#${id}`) {
                        link.classList.add('active');
                    }
                });
            }
        });
    }, observerOptions);

    sections.forEach(section => observer.observe(section));


    /* ==========================================================================
       2. COPISTERÍA DIGITAL CALCULATOR LOGIC
       ========================================================================== */
    // Prices Definition
    const PRICE_PER_PAGE = {
        bw: {
            single: 0.05, // 5 cents single page
            double: 0.04  // 4 cents per page side (8 cents sheet)
        },
        color: {
            single: 0.25, // 25 cents single page
            double: 0.20  // 20 cents per page side (40 cents sheet)
        }
    };

    const BINDING_PRICES = {
        none: 0,
        spiral: 1.50, // Flat fee for spiral binding
        laminate: 1.00 // Per copy fee for laminating
    };

    // Calculator DOM Elements
    const numPagesInput = document.getElementById('num-pages');
    const numCopiesInput = document.getElementById('num-copies');
    const printColorSelect = document.getElementById('print-color');
    const printFormatSelect = document.getElementById('print-format');
    const printSidesSelect = document.getElementById('print-sides');
    const printBindingSelect = document.getElementById('print-binding');

    // Summary DOM Elements
    const summarySheets = document.getElementById('summary-sheets');
    const summarySpecs = document.getElementById('summary-specs');
    const summaryBinding = document.getElementById('summary-binding');
    const summaryCopies = document.getElementById('summary-copies');
    const totalPriceEl = document.getElementById('total-price');
    const whatsappOrderBtn = document.getElementById('whatsapp-order-btn');
    const emailOrderBtn = document.getElementById('email-order-btn');

    // Drag & Drop Elements
    const fileDropzone = document.getElementById('file-dropzone');
    const fileInput = document.getElementById('file-input');
    const dropzonePrompt = document.getElementById('dropzone-prompt');
    const filesListContainer = document.getElementById('files-list-container');
    const filesList = document.getElementById('files-list');
    
    let uploadedFiles = []; // Array of { id, fileObject, pagesCount, sizeString, status }
    
    // Estado de carga conjunta en GoFile
    let sessionFolderId = null;
    let sessionFolderUrl = null;
    let sessionFolderToken = null;
    let uploadQueue = [];
    let isUploading = false;

    // Number Inputs Buttons (+ and -) handlers
    document.querySelectorAll('.num-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const targetId = btn.getAttribute('data-target');
            const input = document.getElementById(targetId);
            
            // Si está deshabilitado, no permitimos cambios (ya que se calcula automáticamente de los PDFs)
            if (input.disabled) return;

            let val = parseInt(input.value) || 1;
            
            if (btn.classList.contains('decrease')) {
                if (val > parseInt(input.min)) {
                    input.value = val - 1;
                }
            } else if (btn.classList.contains('increase')) {
                input.value = val + 1;
            }
            
            // Trigger change event to update calculation
            input.dispatchEvent(new Event('change'));
        });
    });

    // File Drag and Drop events
    fileDropzone.addEventListener('click', (e) => {
        if (e.target.closest('.remove-item-btn') || e.target.closest('.btn-add-more')) {
            return;
        }
        if (uploadedFiles.length > 0 && !e.target.closest('#dropzone-prompt')) {
            return;
        }
        fileInput.click();
    });
    
    // Add more files button handler
    document.getElementById('btn-add-more').addEventListener('click', (e) => {
        e.stopPropagation();
        fileInput.click();
    });
    
    fileDropzone.addEventListener('dragover', (e) => {
        e.preventDefault();
        fileDropzone.classList.add('dragover');
    });

    fileDropzone.addEventListener('dragleave', () => {
        fileDropzone.classList.remove('dragover');
    });

    fileDropzone.addEventListener('drop', (e) => {
        e.preventDefault();
        fileDropzone.classList.remove('dragover');
        if (e.dataTransfer.files.length > 0) {
            handleFilesSelect(e.dataTransfer.files);
        }
    });

    fileInput.addEventListener('change', (e) => {
        if (fileInput.files.length > 0) {
            handleFilesSelect(fileInput.files);
        }
    });

    function handleFilesSelect(files) {
        let pdfFiles = Array.from(files).filter(file => file.type === 'application/pdf');
        
        if (pdfFiles.length === 0 && files.length > 0) {
            alert('Por favor, selecciona solo archivos en formato PDF.');
            return;
        }

        pdfFiles.forEach(file => {
            const isDuplicate = uploadedFiles.some(f => f.fileObject.name === file.name && f.fileObject.size === file.size);
            if (isDuplicate) return;

            const fileId = 'file_' + Math.random().toString(36).substr(2, 9);
            const sizeInMB = (file.size / (1024 * 1024)).toFixed(2);
            
            const fileRecord = {
                id: fileId,
                fileObject: file,
                pagesCount: 0,
                sizeString: `${sizeInMB} MB`,
                status: 'loading'
            };

            uploadedFiles.push(fileRecord);
            renderFileItem(fileRecord);
            detectPDFPageCount(fileRecord);
        });

        updateUI();
    }

    function renderFileItem(fileRecord) {
        const item = document.createElement('div');
        item.className = 'file-item';
        item.id = fileRecord.id;
        item.innerHTML = `
            <div class="file-item-main">
                <span class="file-item-icon">\u{1F4C4}</span>
                <span class="file-item-name" title="${fileRecord.fileObject.name}">${fileRecord.fileObject.name}</span>
                <span class="file-item-size" id="size_${fileRecord.id}">Analizando PDF...</span>
                <button type="button" class="remove-item-btn" aria-label="Quitar archivo">&times;</button>
            </div>
            <div class="file-item-options">
                <div class="file-option-group">
                    <label for="range_${fileRecord.id}">Rango págs. (ej: 1-5, 8):</label>
                    <input type="text" id="range_${fileRecord.id}" class="file-range-input" placeholder="Todo el PDF">
                </div>
                <div class="file-option-group">
                    <label for="note_${fileRecord.id}">Nota de impresión:</label>
                    <input type="text" id="note_${fileRecord.id}" class="file-note-input" placeholder="Ej: Portada color, resto B/N...">
                </div>
            </div>
            <div class="file-progress-bar-container">
                <div class="file-progress-bar" id="progress_${fileRecord.id}"></div>
            </div>
        `;
        
        item.querySelector('.remove-item-btn').addEventListener('click', (e) => {
            e.stopPropagation();
            removeFileRecord(fileRecord.id);
        });

        // Vincular los escuchadores para actualizar rango y nota dinámicamente
        item.querySelector('.file-range-input').addEventListener('input', (e) => {
            fileRecord.pageRange = e.target.value;
            updateCalculations();
        });
        item.querySelector('.file-note-input').addEventListener('input', (e) => {
            fileRecord.note = e.target.value;
        });

        filesList.appendChild(item);
    }

    function removeFileRecord(id) {
        uploadedFiles = uploadedFiles.filter(f => f.id !== id);
        const element = document.getElementById(id);
        if (element) element.remove();
        
        // Si no quedan archivos en lista, reseteamos la carpeta conjunta para el siguiente grupo
        if (uploadedFiles.length === 0) {
            sessionFolderId = null;
            sessionFolderUrl = null;
            sessionFolderToken = null;
            uploadQueue = [];
            isUploading = false;
        }

        updateUI();
        updateCalculations();
    }

    function updateUI() {
        if (uploadedFiles.length > 0) {
            dropzonePrompt.style.display = 'none';
            filesListContainer.style.display = 'flex';
            fileDropzone.style.borderColor = 'var(--color-accent)';
        } else {
            dropzonePrompt.style.display = 'block';
            filesListContainer.style.display = 'none';
            fileDropzone.style.borderColor = '#cbd5e1';
            fileInput.value = '';
        }
    }

    async function detectPDFPageCount(fileRecord) {
        const fileName = fileRecord.fileObject.name.toLowerCase();
        if (!fileName.endsWith('.pdf')) {
            // No es un archivo PDF. No intentamos contarlo. Asignamos 1 página por defecto y subimos
            fileRecord.pagesCount = 1;
            fileRecord.status = 'ready';
            const sizeEl = document.getElementById(`size_${fileRecord.id}`);
            if (sizeEl) {
                sizeEl.textContent = `${fileRecord.sizeString} (1 pág.)`;
            }
            updateCalculations();
            enqueueUpload(fileRecord);
            return;
        }

        const reader = new FileReader();
        reader.onload = async function() {
            try {
                const typedarray = new Uint8Array(this.result);
                
                if (typeof pdfjsLib !== 'undefined') {
                    pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.worker.min.js';
                    const loadingTask = pdfjsLib.getDocument({ data: typedarray });
                    const pdf = await loadingTask.promise;
                    
                    fileRecord.pagesCount = pdf.numPages;
                    fileRecord.status = 'ready';
                    
                    const sizeEl = document.getElementById(`size_${fileRecord.id}`);
                    if (sizeEl) {
                        sizeEl.textContent = `${fileRecord.sizeString} (${pdf.numPages} ${pdf.numPages === 1 ? 'pág.' : 'págs.'})`;
                    }
                    
                    updateCalculations();
                    // Encolar la subida del archivo en la cola secuencial
                    enqueueUpload(fileRecord);
                } else {
                    throw new Error("pdfjsLib undefined");
                }
            } catch (error) {
                console.error("Error leyendo las páginas del PDF:", error);
                fileRecord.status = 'error';
                fileRecord.pagesCount = 1;
                
                const sizeEl = document.getElementById(`size_${fileRecord.id}`);
                if (sizeEl) {
                    sizeEl.textContent = `${fileRecord.sizeString} (Manual)`;
                }
                
                updateCalculations();
                // Encolar la subida del archivo incluso si falló el conteo
                enqueueUpload(fileRecord);
            }
        };
        
        reader.readAsArrayBuffer(fileRecord.fileObject);
    }

    /* ==========================================================================
       GESTIÓN DE COLA DE SUBIDA (GoFile Folder Upload Grouping)
       ========================================================================== */
    function enqueueUpload(fileRecord) {
        uploadQueue.push(fileRecord);
        processUploadQueue();
    }

    async function processUploadQueue() {
        if (isUploading || uploadQueue.length === 0) return;
        
        isUploading = true;
        const nextFile = uploadQueue.shift();
        
        try {
            await uploadFileToCloud(nextFile);
        } catch (e) {
            console.error("Error en cola de subida:", e);
        }
        
        isUploading = false;
        processUploadQueue();
    }

    // Obtener dinámicamente el servidor activo de GoFile
    async function getGoFileServer() {
        try {
            const response = await fetch('https://api.gofile.io/servers');
            const data = await response.json();
            if (data.status === 'ok' && data.data && data.data.servers && data.data.servers.length > 0) {
                return data.data.servers[0].name;
            }
        } catch (e) {
            console.error("Error al obtener servidor de GoFile:", e);
        }
        return 'store1';
    }

    function uploadFileToCloud(fileRecord) {
        return new Promise((resolve, reject) => {
            const sizeEl = document.getElementById(`size_${fileRecord.id}`);
            const itemEl = document.getElementById(fileRecord.id);
            
            fileRecord.status = 'uploading';
            if (itemEl) {
                itemEl.classList.remove('uploaded', 'upload-error');
                itemEl.classList.add('uploading');
            }

            getGoFileServer().then(serverName => {
                const uploadUrl = `https://${serverName}.gofile.io/contents/uploadfile`;
                const xhr = new XMLHttpRequest();
                
                xhr.upload.onprogress = function(event) {
                    if (event.lengthComputable) {
                        const percent = Math.round((event.loaded / event.total) * 100);
                        if (sizeEl) {
                            const pagesText = fileRecord.pagesCount > 0 ? ` (${fileRecord.pagesCount} ${fileRecord.pagesCount === 1 ? 'pág.' : 'págs.'})` : '';
                            sizeEl.textContent = `${fileRecord.sizeString}${pagesText} - Subiendo (${percent}%)...`;
                        }
                        const progressEl = document.getElementById(`progress_${fileRecord.id}`);
                        if (progressEl) {
                            progressEl.style.width = `${percent}%`;
                        }
                    }
                };

                xhr.onload = function() {
                    if (xhr.status >= 200 && xhr.status < 300) {
                        try {
                            const response = JSON.parse(xhr.responseText);
                            console.log("Respuesta de GoFile recibida:", response);
                            if (response.status === 'ok' && response.data && response.data.downloadPage) {
                                // Si es el primer archivo, guardamos la carpeta para meter los siguientes
                                if (!sessionFolderId) {
                                    sessionFolderId = response.data.parentFolder || response.data.folderId || response.data.code;
                                    sessionFolderUrl = response.data.downloadPage;
                                    sessionFolderToken = response.data.guestToken || response.data.token || null;
                                }
                                
                                fileRecord.downloadUrl = sessionFolderUrl;
                                fileRecord.status = 'uploaded';

                                if (itemEl) {
                                    itemEl.classList.remove('uploading');
                                    itemEl.classList.add('uploaded');
                                }

                                if (sizeEl) {
                                    const pagesText = fileRecord.pagesCount > 0 ? ` (${fileRecord.pagesCount} ${fileRecord.pagesCount === 1 ? 'pág.' : 'págs.'})` : '';
                                    sizeEl.textContent = `${fileRecord.sizeString}${pagesText} - Listo`;
                                }
                                updateCalculations();
                                resolve(response);
                            } else {
                                throw new Error('Respuesta de GoFile inválida');
                            }
                        } catch (e) {
                            handleUploadError(fileRecord, sizeEl, xhr);
                            reject(e);
                        }
                    } else {
                        handleUploadError(fileRecord, sizeEl, xhr);
                        reject(new Error(`Status ${xhr.status}`));
                    }
                };

                xhr.onerror = function() {
                    handleUploadError(fileRecord, sizeEl, xhr);
                    reject(new Error('Network error'));
                };

                const formData = new FormData();
                formData.append('file', fileRecord.fileObject);
                if (sessionFolderId) {
                    formData.append('folderId', sessionFolderId);
                }
                if (sessionFolderToken) {
                    formData.append('token', sessionFolderToken);
                }

                xhr.open('POST', uploadUrl, true);
                if (sessionFolderToken) {
                    xhr.setRequestHeader('Authorization', `Bearer ${sessionFolderToken}`);
                }
                xhr.send(formData);
            }).catch(e => {
                handleUploadError(fileRecord, sizeEl, null);
                reject(e);
            });
        });
    }

    function handleUploadError(fileRecord, sizeEl, xhr) {
        fileRecord.status = 'error';
        const itemEl = document.getElementById(fileRecord.id);
        
        if (itemEl) {
            itemEl.classList.remove('uploading');
            itemEl.classList.add('upload-error');
        }

        let detail = 'Error al subir';
        if (xhr) {
            if (xhr.status === 0) {
                detail = 'Error (CORS/Adblocker)';
            } else {
                detail = `Error (status ${xhr.status})`;
            }
        }
        if (sizeEl) {
            const pagesText = fileRecord.pagesCount > 0 ? ` (${fileRecord.pagesCount} ${fileRecord.pagesCount === 1 ? 'pág.' : 'págs.'})` : '';
            sizeEl.textContent = `${fileRecord.sizeString}${pagesText} - ${detail}`;
        }
        updateCalculations();
    }

    /* ==========================================================================
       PARSEO DE RANGO DE PÁGINAS (ej: "1-5, 8, 11-13")
       ========================================================================== */
    function parsePageRange(rangeStr, maxPages) {
        if (!rangeStr || rangeStr.trim() === '') return maxPages;
        
        const ranges = rangeStr.split(',');
        const countedPages = new Set();
        
        for (let r of ranges) {
            r = r.trim();
            if (r.includes('-')) {
                const parts = r.split('-');
                const start = parseInt(parts[0]);
                const end = parseInt(parts[1]);
                if (!isNaN(start) && !isNaN(end)) {
                    const min = Math.min(start, end);
                    const max = Math.max(start, end);
                    for (let i = min; i <= max; i++) {
                        if (i >= 1 && i <= maxPages) {
                            countedPages.add(i);
                        }
                    }
                }
            } else {
                const page = parseInt(r);
                if (!isNaN(page) && page >= 1 && page <= maxPages) {
                    countedPages.add(page);
                }
            }
        }
        
        return countedPages.size > 0 ? countedPages.size : maxPages;
    }

    // Calculation Logic
    function updateCalculations() {
        // Automatically sum up pages from files if uploaded
        if (uploadedFiles.length > 0) {
            const totalPages = uploadedFiles.reduce((sum, f) => {
                const max = f.pagesCount || 1;
                return sum + parsePageRange(f.pageRange, max);
            }, 0);
            numPagesInput.value = totalPages;
            numPagesInput.disabled = true;
            numPagesInput.classList.add('disabled-input');
        } else {
            numPagesInput.disabled = false;
            numPagesInput.classList.remove('disabled-input');
        }

        const pages = parseInt(numPagesInput.value) || 1;
        const copies = parseInt(numCopiesInput.value) || 1;
        const color = printColorSelect.value;
        const format = printFormatSelect.value;
        const sides = printSidesSelect.value;
        const binding = printBindingSelect.value;

        // Validation limits
        if (pages < 1 && !numPagesInput.disabled) numPagesInput.value = 1;
        if (copies < 1) numCopiesInput.value = 1;

        // 1. Calculate Sheet Count (Hojas físicas)
        let sheets = pages;
        if (sides === 'double') {
            sheets = Math.ceil(pages / 2);
        }

        // 2. Base Price Calculation (Page printing)
        const formatMultiplier = format === 'a3' ? 2 : 1;
        const unitPagePrice = PRICE_PER_PAGE[color][sides];
        
        let printPrice = pages * unitPagePrice * formatMultiplier * copies;

        // 3. Binding calculation
        let bindingCost = 0;
        if (binding === 'spiral') {
            bindingCost = BINDING_PRICES.spiral * copies;
        } else if (binding === 'laminate') {
            bindingCost = BINDING_PRICES.laminate * sheets * copies;
        }

        // Total
        const total = printPrice + bindingCost;

        // Update Summary DOM
        summarySheets.textContent = sheets;
        summaryCopies.textContent = copies;
        
        const colorText = color === 'bw' ? 'B/N' : 'Color';
        const sidesText = sides === 'double' ? 'Doble Cara' : 'Una Cara';
        summarySpecs.textContent = `${format.toUpperCase()}, ${colorText}, ${sidesText}`;

        let bindingTextSpan = 'Ninguna';
        if (binding === 'spiral') bindingTextSpan = 'Espiral';
        if (binding === 'laminate') bindingTextSpan = 'Plastificado';
        summaryBinding.textContent = bindingTextSpan;

        totalPriceEl.textContent = `${total.toFixed(2)} €`;
    }

    // Bind event listeners to update price on any change
    [numPagesInput, numCopiesInput, printColorSelect, printFormatSelect, printSidesSelect, printBindingSelect].forEach(element => {
        element.addEventListener('change', updateCalculations);
        element.addEventListener('input', updateCalculations);
    });

    // Run initial calculations
    updateCalculations();

    // WhatsApp Order Action (Direct redirect with PDF links!)
    whatsappOrderBtn.addEventListener('click', () => {
        // Verificar si algún archivo aún se está subiendo
        const stillUploading = uploadedFiles.some(f => f.status === 'uploading');
        if (stillUploading) {
            alert('Estamos subiendo tus archivos PDF temporales para que la papelería los abra con un clic. Por favor, espera unos segundos a que finalice.');
            return;
        }

        const pages = numPagesInput.value;
        const copies = numCopiesInput.value;
        const color = printColorSelect.value === 'bw' ? 'Blanco y Negro' : 'Color';
        const format = printFormatSelect.value.toUpperCase();
        const sides = printSidesSelect.value === 'double' ? 'Doble Cara' : 'Una sola Cara';
        
        let binding = 'Sin encuadernar';
        if (printBindingSelect.value === 'spiral') binding = 'Encuadernación Espiral';
        if (printBindingSelect.value === 'laminate') binding = 'Plastificado';

        const price = totalPriceEl.textContent;
        
        // List files in message
        let filesText = '';
        if (uploadedFiles.length > 0) {
            filesText = uploadedFiles.map((f, i) => {
                const max = f.pagesCount || 1;
                const printedPages = parsePageRange(f.pageRange, max);
                const rangeText = f.pageRange ? ` [Rango: ${f.pageRange} (${printedPages} págs)]` : ` [Completo (${max} págs)]`;
                const noteText = f.note ? `\n     \u{270E} Nota: "${f.note}"` : '';
                return `   ${i+1}. *${f.fileObject.name}*${rangeText}${noteText}`;
            }).join('\n');
        } else {
            filesText = `   - Ningún archivo adjunto (Enviar a continuación)`;
        }

        // Formulate WhatsApp message in Spanish using safe Unicode escapes for emojis
        let message = `¡Hola, Dobleeme! Quisiera encargar una impresión de varios archivos:\n\n`;
        message += `\u{1F4C2} *Archivos a imprimir:*\n${filesText}\n\n`;
        
        if (sessionFolderUrl) {
            message += `\u{1F517} *Enlace de descarga conjunto:*\n${sessionFolderUrl}\n\n`;
        }
        
        message += `\u{1F4C4} *Total páginas:* ${pages}\n`;
        message += `\u{1F465} *Número de copias de todo:* ${copies}\n`;
        message += `\u{2699}\u{FE0F} *Detalles:* A4/A3: ${format} | ${color} | ${sides}\n`;
        message += `\u{1F517} *Acabado:* ${binding}\n`;
        message += `\u{1F4B5} *Precio estimado:* ${price}\n\n`;
        message += `¿Me confirmáis si está correcto? Gracias.`;

        // Create WhatsApp URL API
        const whatsappNumber = '34640504531';
        const whatsappUrl = `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(message)}`;
        
        // Redirect directly
        window.open(whatsappUrl, '_blank');
    });

    // Email Order Action
    if (emailOrderBtn) {
        emailOrderBtn.addEventListener('click', () => {
            const stillUploading = uploadedFiles.some(f => f.status === 'uploading');
            if (stillUploading) {
                alert('Estamos subiendo tus archivos. Por favor, espera unos segundos.');
                return;
            }

            const pages = numPagesInput.value;
            const copies = numCopiesInput.value;
            const color = printColorSelect.value === 'bw' ? 'Blanco y Negro' : 'Color';
            const format = printFormatSelect.value.toUpperCase();
            const sides = printSidesSelect.value === 'double' ? 'Doble Cara' : 'Una sola Cara';
            let binding = 'Sin encuadernar';
            if (printBindingSelect.value === 'spiral') binding = 'Encuadernacion Espiral';
            if (printBindingSelect.value === 'laminate') binding = 'Plastificado';
            const price = totalPriceEl.textContent;

            let filesText = '';
            if (uploadedFiles.length > 0) {
                filesText = uploadedFiles.map((f, i) => {
                    const max = f.pagesCount || 1;
                    const printedPages = parsePageRange(f.pageRange, max);
                    const rangeText = f.pageRange ? ` [Rango: ${f.pageRange} (${printedPages} pags)]` : ` [Completo (${max} pags)]`;
                    const noteText = f.note ? ` | Nota: "${f.note}"` : '';
                    return `  ${i+1}. ${f.fileObject.name}${rangeText}${noteText}`;
                }).join('\n');
            } else {
                filesText = '  - Sin archivos adjuntos (adjuntar al enviar el email)';
            }

            const subject = encodeURIComponent('Pedido de Impresion - Dobleeme Papeleria');
            let body = `Hola, Dobleeme! Quisiera encargar una impresion:\n\n`;
            body += `ARCHIVOS A IMPRIMIR:\n${filesText}\n\n`;
            if (sessionFolderUrl) {
                body += `Enlace de descarga conjunto: ${sessionFolderUrl}\n\n`;
            }
            body += `Total paginas: ${pages}\n`;
            body += `Numero de copias: ${copies}\n`;
            body += `Detalles: ${format} | ${color} | ${sides}\n`;
            body += `Acabado: ${binding}\n`;
            body += `Precio estimado: ${price}\n\n`;
            body += `Confirmadme si esta correcto. Gracias.`;

            const emailAddress = 'tcasu007@gmail.com';
            const mailtoUrl = `mailto:${emailAddress}?subject=${subject}&body=${encodeURIComponent(body)}`;
            const tempLink = document.createElement('a');
            tempLink.href = mailtoUrl;
            document.body.appendChild(tempLink);
            tempLink.click();
            document.body.removeChild(tempLink);
        });
    }


    /* ==========================================================================
       3. GOOGLE REVIEWS CAROUSEL
       ========================================================================== */
    const carouselSlides = document.querySelectorAll('.carousel-slide');
    const dotsContainer = document.getElementById('carousel-dots-container');
    const prevBtn = document.getElementById('prev-review');
    const nextBtn = document.getElementById('next-review');
    
    let currentSlide = 0;
    const totalSlides = carouselSlides.length;
    let autoPlayInterval;

    function showSlide(index) {
        // Handle overflow loop
        if (index >= totalSlides) index = 0;
        if (index < 0) index = totalSlides - 1;
        
        currentSlide = index;

        // Update active slide classes
        carouselSlides.forEach((slide, i) => {
            slide.classList.remove('active');
            if (i === currentSlide) {
                slide.classList.add('active');
            }
        });

        // Update active dots
        const dots = dotsContainer.querySelectorAll('.dot-indicator');
        dots.forEach((dot, i) => {
            dot.classList.remove('active');
            if (i === currentSlide) {
                dot.classList.add('active');
            }
        });
    }

    function nextSlide() {
        showSlide(currentSlide + 1);
    }

    function prevSlide() {
        showSlide(currentSlide - 1);
    }

    // Auto Play function
    function startAutoPlay() {
        autoPlayInterval = setInterval(nextSlide, 6000); // 6 seconds slide duration
    }

    function stopAutoPlay() {
        clearInterval(autoPlayInterval);
    }

    // Event listeners
    prevBtn.addEventListener('click', () => {
        stopAutoPlay();
        prevSlide();
        startAutoPlay();
    });

    nextBtn.addEventListener('click', () => {
        stopAutoPlay();
        nextSlide();
        startAutoPlay();
    });

    // Dots navigation
    dotsContainer.querySelectorAll('.dot-indicator').forEach(dot => {
        dot.addEventListener('click', (e) => {
            stopAutoPlay();
            const index = parseInt(e.target.getAttribute('data-index'));
            showSlide(index);
            startAutoPlay();
        });
    });

    // Initialize Reviews Autoplay
    startAutoPlay();


    /* ==========================================================================
       4. FAQ ACCORDION LOGIC
       ========================================================================== */
    const faqItems = document.querySelectorAll('.faq-item');

    faqItems.forEach(item => {
        const questionBtn = item.querySelector('.faq-question');
        
        questionBtn.addEventListener('click', () => {
            const isActive = item.classList.contains('active');
            
            // Close all items
            faqItems.forEach(faq => {
                faq.classList.remove('active');
            });
            
            // If it wasn't active, open it
            if (!isActive) {
                item.classList.add('active');
            }
        });
    });

    /* ==========================================================================
       5. SCROLL REVEAL ANIMATIONS
       ========================================================================== */
    const revealElements = document.querySelectorAll('section, .calculator-container, .step-card, .product-card');
    
    const revealObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('scroll-animated');
                revealObserver.unobserve(entry.target); // Animate only once
            }
        });
    }, {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px'
    });

    revealElements.forEach(el => {
        el.classList.add('scroll-reveal');
        revealObserver.observe(el);
    });

    // (El selector de Modo Oscuro ha sido removido temporalmente por solicitud del usuario)

    /* ==========================================================================
       7. REAL-TIME SHOP OPEN/CLOSED INDICATOR
       ========================================================================== */
    function getMadridTime() {
        const now = new Date();
        const formatter = new Intl.DateTimeFormat('es-ES', {
            timeZone: 'Europe/Madrid',
            hour: 'numeric',
            minute: 'numeric',
            hour12: false,
            weekday: 'long'
        });
        const parts = formatter.formatToParts(now);
        const partMap = {};
        parts.forEach(p => partMap[p.type] = p.value);
        
        let weekday = partMap.weekday ? partMap.weekday.toLowerCase() : '';
        // Normalizar para quitar acentos (ej. sábado -> sabado)
        weekday = weekday.normalize("NFD").replace(/[\u0300-\u036f]/g, ""); 
        
        const hour = parseInt(partMap.hour) || 0;
        const minute = parseInt(partMap.minute) || 0;
        
        return { weekday, hour, minute };
    }

    function updateShopStatus() {
        const badge = document.getElementById('shop-status-badge');
        if (!badge) return;
        
        const { weekday, hour, minute } = getMadridTime();
        const minutes = hour * 60 + minute;
        
        const isWeekend = weekday.includes('sab') || weekday.includes('dom');
        
        if (isWeekend) {
            badge.className = 'shop-status-badge closed';
            badge.textContent = '🔴 Cerrado ahora (Abrimos el lunes a las 09:00)';
            return;
        }
        
        const morningOpen = 9 * 60;
        const morningClose = 14 * 60;
        const afternoonOpen = 17 * 60;
        const afternoonClose = 20 * 60 + 30;
        
        if (minutes >= morningOpen && minutes < morningClose) {
            badge.className = 'shop-status-badge open';
            badge.textContent = '🟢 Abierto ahora (Cerramos a las 14:00)';
        } else if (minutes >= afternoonOpen && minutes < afternoonClose) {
            badge.className = 'shop-status-badge open';
            badge.textContent = '🟢 Abierto ahora (Cerramos a las 20:30)';
        } else {
            badge.className = 'shop-status-badge closed';
            if (minutes < morningOpen) {
                badge.textContent = '🔴 Cerrado ahora (Abrimos hoy a las 09:00)';
            } else if (minutes >= morningClose && minutes < afternoonOpen) {
                badge.textContent = '🔴 Cerrado ahora (Abrimos esta tarde a las 17:00)';
            } else {
                badge.textContent = '🔴 Cerrado ahora (Abrimos mañana a las 09:00)';
            }
        }
    }

    // Inicializar estado comercial y refrescar cada minuto
    updateShopStatus();
    setInterval(updateShopStatus, 60000);

});
