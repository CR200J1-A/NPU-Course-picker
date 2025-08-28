// ==UserScript==
// @name         西工大课程表下载和解析工具
// @namespace    http://tampermonkey.net/
// @version      2.0
// @description  自动从西工大教务系统获取课程表HTML并生成CSV文件
// @author       立及甬
// @match        https://jwxt.nwpu.edu.cn/student/for-std/course-table*
// @grant        none
// @run-at       document-ready
// ==/UserScript==

(function() {
    'use strict';
    
    console.log('🚀 西工大教务系统课程表下载和解析工具启动...');
    
    // 添加操作按钮到页面
    function addControlButtons() {
        // 避免重复添加按钮
        if (document.getElementById('course-parser-buttons')) {
            return;
        }
        
        // 创建按钮容器
        const buttonContainer = document.createElement('div');
        buttonContainer.id = 'course-parser-buttons';
        buttonContainer.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            z-index: 10000;
            display: flex;
            flex-direction: column;
            gap: 10px;
        `;
        
        // 创建获取课程表HTML按钮
        const fetchButton = document.createElement('button');
        fetchButton.innerHTML = '📥 获取课程表HTML';
        fetchButton.style.cssText = `
            padding: 10px 15px;
            background: #1976D2;
            color: white;
            border: none;
            border-radius: 5px;
            cursor: pointer;
            font-size: 14px;
            box-shadow: 0 2px 5px rgba(0,0,0,0.2);
            transition: background-color 0.3s ease;
        `;
        
        // 创建解析CSV按钮
        const parseButton = document.createElement('button');
        parseButton.innerHTML = '📊 解析生成CSV';
        parseButton.style.cssText = `
            padding: 10px 15px;
            background: #4CAF50;
            color: white;
            border: none;
            border-radius: 5px;
            cursor: pointer;
            font-size: 14px;
            box-shadow: 0 2px 5px rgba(0,0,0,0.2);
            transition: background-color 0.3s ease;
        `;
        
        // 创建一键处理按钮
        const allInOneButton = document.createElement('button');
        allInOneButton.innerHTML = '🚀 一键获取+解析';
        allInOneButton.style.cssText = `
            padding: 10px 15px;
            background: #FF9800;
            color: white;
            border: none;
            border-radius: 5px;
            cursor: pointer;
            font-size: 14px;
            font-weight: bold;
            box-shadow: 0 2px 5px rgba(0,0,0,0.2);
            transition: background-color 0.3s ease;
        `;
        
        // 创建调试按钮
        const debugButton = document.createElement('button');
        debugButton.innerHTML = '🔍 调试信息';
        debugButton.style.cssText = `
            padding: 8px 12px;
            background: #607D8B;
            color: white;
            border: none;
            border-radius: 5px;
            cursor: pointer;
            font-size: 12px;
            box-shadow: 0 2px 5px rgba(0,0,0,0.2);
        `;
        
        // 绑定事件处理
        fetchButton.addEventListener('click', downloadCourseTable);
        parseButton.addEventListener('click', parseFromCurrentPage);
        allInOneButton.addEventListener('click', processAllInOne);
        debugButton.addEventListener('click', showDebugInfo);
        
        // 鼠标悬停效果
        const buttons = [fetchButton, parseButton, allInOneButton, debugButton];
        const hoverColors = ['#1565C0', '#45a049', '#F57C00', '#546E7A'];
        const normalColors = ['#1976D2', '#4CAF50', '#FF9800', '#607D8B'];
        
        buttons.forEach((button, index) => {
            button.addEventListener('mouseover', () => {
                button.style.background = hoverColors[index];
            });
            button.addEventListener('mouseout', () => {
                button.style.background = normalColors[index];
            });
        });
        
        // 添加按钮到容器
        buttonContainer.appendChild(allInOneButton);
        buttonContainer.appendChild(fetchButton);
        buttonContainer.appendChild(parseButton);
        buttonContainer.appendChild(debugButton);
        
        document.body.appendChild(buttonContainer);
        console.log('✅ 已添加课程表操作按钮');
    }
    
    // 等待页面元素加载
    function waitForElement(selector, timeout = 10000) {
        return new Promise((resolve, reject) => {
            const startTime = Date.now();
            
            function checkElement() {
                const element = document.querySelector(selector);
                if (element) {
                    resolve(element);
                } else if (Date.now() - startTime > timeout) {
                    reject(new Error(`Element ${selector} not found within ${timeout}ms`));
                } else {
                    setTimeout(checkElement, 100);
                }
            }
            
            checkElement();
        });
    }

    // 获取学期信息
    function getCurrentSemester() {
        console.log('正在查找学期信息...');
        
        // 优先从JavaScript变量获取
        if (window.semesterId) {
            console.log('从全局变量semesterId获取学期:', window.semesterId);
            return {
                value: window.semesterId,
                text: window.semesterId
            };
        }
        
        if (window.currentSemester && window.currentSemester.id) {
            console.log('从currentSemester对象获取学期:', window.currentSemester);
            return {
                value: window.currentSemester.id,
                text: window.currentSemester.nameZh || window.currentSemester.name || window.currentSemester.id
            };
        }
        
        // 尝试多种选择器
        const selectors = [
            '#allSemesters',
            'select[name="semester"]',
            'select[id*="semester"]',
            'select[id*="Semester"]',
            '.semester-select',
            'select'
        ];
        
        for (let selector of selectors) {
            const semesterSelect = document.querySelector(selector);
            if (semesterSelect) {
                console.log(`找到学期选择器: ${selector}`, semesterSelect);
                const selectedOption = semesterSelect.querySelector('option[selected]') || 
                                     semesterSelect.options[semesterSelect.selectedIndex];
                if (selectedOption && selectedOption.value) {
                    console.log('学期信息:', {
                        value: selectedOption.value,
                        text: selectedOption.textContent.trim()
                    });
                    return {
                        value: selectedOption.value,
                        text: selectedOption.textContent.trim()
                    };
                }
            }
        }
        
        // 尝试从页面文本中提取学期信息
        const semesterRegex = /(\d{4}-\d{4}-\d+[春夏秋冬])/;
        const pageText = document.body.textContent;
        const match = pageText.match(semesterRegex);
        if (match) {
            console.log('从页面文本中提取到学期:', match[1]);
            return {
                value: match[1],
                text: match[1]
            };
        }
        
        console.log('未找到学期信息');
        return null;
    }

    // 获取学生ID
    function getStudentAssoc() {
        console.log('正在查找学生ID...');
        
        // 优先从JavaScript变量获取
        if (window.dataId) {
            console.log('从全局变量dataId获取学生ID:', window.dataId);
            return window.dataId.toString();
        }
        
        if (window.personId) {
            console.log('从全局变量personId获取学生ID:', window.personId);
            return window.personId.toString();
        }
        
        if (window.studentId) {
            console.log('从全局变量studentId获取学生ID:', window.studentId);
            return window.studentId.toString();
        }
        
        // 尝试从多种输入元素获取
        const inputSelectors = [
            '#studentId',
            'input[name="studentId"]',
            'input[name="student"]',
            'input[id*="student"]',
            'input[id*="Student"]'
        ];
        
        for (let selector of inputSelectors) {
            const element = document.querySelector(selector);
            if (element && element.value) {
                console.log(`从输入框获取学生ID: ${selector}`, element.value);
                return element.value;
            }
        }
        
        // 尝试从按钮获取
        const buttons = document.querySelectorAll('button');
        for (let button of buttons) {
            if (button.value && button.value.length > 10) {
                console.log('从按钮获取学生ID:', button.value);
                return button.value;
            }
        }
        
        // 尝试从页面中的data属性获取
        const dataElements = document.querySelectorAll('[data-student-id], [data-studentid], [data-student]');
        for (let element of dataElements) {
            const studentId = element.dataset.studentId || element.dataset.studentid || element.dataset.student;
            if (studentId) {
                console.log('从data属性获取学生ID:', studentId);
                return studentId;
            }
        }
        
        // 尝试从URL参数获取
        const urlParams = new URLSearchParams(window.location.search);
        const studentParam = urlParams.get('studentId') || urlParams.get('student') || urlParams.get('studentAssoc');
        if (studentParam) {
            console.log('从URL参数获取学生ID:', studentParam);
            return studentParam;
        }
        
        // 尝试从页面路径中提取
        const pathMatch = window.location.pathname.match(/\/student\/.*?\/(\d+)/);
        if (pathMatch) {
            console.log('从URL路径获取学生ID:', pathMatch[1]);
            return pathMatch[1];
        }
        
        // 尝试从localStorage或sessionStorage获取
        const storageId = localStorage.getItem('studentId') || sessionStorage.getItem('studentId');
        if (storageId) {
            console.log('从本地存储获取学生ID:', storageId);
            return storageId;
        }
        
        console.log('未找到学生ID');
        return null;
    }

    // 显示通知
    function showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed;
            top: 100px;
            right: 20px;
            padding: 12px 20px;
            border-radius: 4px;
            color: white;
            font-size: 14px;
            z-index: 10001;
            transition: all 0.3s ease;
            max-width: 300px;
            ${type === 'success' ? 'background-color: #4CAF50;' : 
              type === 'error' ? 'background-color: #f44336;' : 
              'background-color: #2196F3;'}
        `;
        notification.textContent = message;
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.style.opacity = '0';
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, 300);
        }, 3000);
    }

    // 下载课程表HTML - 通过API请求获取
    async function downloadCourseTable() {
        try {
            console.log('开始获取课程表HTML...');
            console.log('当前页面URL:', window.location.href);
            
            const semester = getCurrentSemester();
            const studentAssoc = getStudentAssoc();
            
            console.log('获取到的信息:', { semester, studentAssoc });
            
            if (!semester || !studentAssoc) {
                // 如果无法获取信息，尝试手动输入
                const manualSemester = prompt('无法自动获取学期信息，请手动输入学期ID (如: 2024-2025-1-1):');
                const manualStudentId = prompt('无法自动获取学生ID，请手动输入学生ID:');
                
                if (!manualSemester || !manualStudentId) {
                    showNotification('缺少必要信息，无法获取课程表', 'error');
                    return null;
                }
                
                // 使用手动输入的信息
                const apiUrl = `https://jwxt.nwpu.edu.cn/student/for-std/course-table/semester/${manualSemester}/print-data/${manualStudentId}?hasExperiment=true`;
                return await fetchCourseTableFromUrl(apiUrl, String(manualSemester));
            }

            // 构造API URL
            const apiUrl = `https://jwxt.nwpu.edu.cn/student/for-std/course-table/semester/${semester.value}/print-data/${studentAssoc}?hasExperiment=true`;
            return await fetchCourseTableFromUrl(apiUrl, String(semester.text || semester.value));
            
        } catch (error) {
            console.error('获取课程表失败:', error);
            showNotification(`获取课程表失败: ${error.message}`, 'error');
            return null;
        }
    }
    
    // 从URL获取课程表HTML
    async function fetchCourseTableFromUrl(apiUrl, filename) {
        console.log('正在请求课程表API...', apiUrl);
        showNotification('正在请求课程表数据...', 'info');
        
        // 确保filename是字符串类型，并进行安全的文件名处理
        const safeFilename = String(filename || 'course-table').replace(/[^a-zA-Z0-9\u4e00-\u9fa5\-_]/g, '_');
        
        try {
            // 发送请求
            const response = await fetch(apiUrl, {
                method: 'GET',
                credentials: 'same-origin', // 包含cookies
                headers: {
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                    'X-Requested-With': 'XMLHttpRequest'
                }
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const htmlContent = await response.text();
            
            // 创建完整的HTML文档
            const fullHTML = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>课程表 - ${safeFilename}</title>
    <style>
        body { 
            font-family: 'Microsoft YaHei', Arial, sans-serif; 
            margin: 20px; 
            background-color: #f5f5f5;
        }
        .export-content {
            background: white;
            padding: 20px;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        table { 
            border-collapse: collapse; 
            width: 100%; 
            margin: 10px 0;
        }
        th, td { 
            border: 1px solid #ddd; 
            padding: 8px; 
            text-align: center; 
            vertical-align: top;
        }
        th { 
            background-color: #f5f5f5; 
            font-weight: bold;
        }
        .course-name { 
            font-weight: bold; 
            margin: 2px 0; 
            color: #333;
        }
        .tdHtml {
            min-height: 60px;
            font-size: 12px;
            line-height: 1.4;
        }
        .course-info {
            margin: 2px 0;
            font-size: 11px;
            color: #666;
        }
    </style>
</head>
<body>
    <div class="export-content">
        <h2>课程表 - ${safeFilename}</h2>
        ${htmlContent}
    </div>
</body>
</html>`;
            
            // 下载HTML文件
            const blob = new Blob([fullHTML], { type: 'text/html;charset=utf-8' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `course-table-${safeFilename}.html`;
            a.style.display = 'none';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            
            console.log(`课程表HTML下载成功: ${safeFilename}`);
            showNotification(`课程表HTML下载成功: ${safeFilename}`, 'success');
            
            return fullHTML;
            
        } catch (error) {
            console.error('获取课程表HTML失败:', error);
            showNotification(`获取课程表HTML失败: ${error.message}`, 'error');
            return null;
        }
    }

    // 1. 提取并下载HTML - 从当前页面
    function downloadHTML() {
        // 寻找课程表内容，兼容不同的页面结构
        let html = document.querySelector('.export-content')?.outerHTML;
        
        // 如果没找到，尝试其他可能的选择器
        if (!html) {
            html = document.querySelector('table.courseTable')?.closest('div')?.outerHTML;
        }
        if (!html) {
            html = document.querySelector('.course-table')?.outerHTML;
        }
        if (!html) {
            html = document.querySelector('#courseTable')?.outerHTML;
        }
        
        if (!html || html === '未找到课程表') {
            console.error('❌ 未找到课程表内容');
            alert('未找到课程表内容，请确保在正确的页面上运行此脚本');
            return null;
        }
        
        console.log('✅ 成功提取课程表HTML');
        
        // 创建完整的HTML文档
        const fullHTML = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>课程表</title>
    <style>
        body { font-family: 'Microsoft YaHei', Arial, sans-serif; margin: 20px; }
        table { border-collapse: collapse; width: 100%; }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: center; }
        th { background-color: #f5f5f5; }
        .course-name { font-weight: bold; margin: 2px 0; }
    </style>
</head>
<body>
${html}
</body>
</html>`;
        
        // 下载HTML文件
        try {
            const blob = new Blob([fullHTML], {type: 'text/html;charset=utf-8'});
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'course-table.html';
            a.style.display = 'none';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            setTimeout(() => URL.revokeObjectURL(url), 100);
            
            console.log('📥 HTML文件下载完成：course-table.html');
        } catch (error) {
            console.error('HTML下载失败：', error);
        }
        
        return html;
    }
    
    // 2. 解析课程表数据
    function parseCourseTable() {
        // 尝试多种方式找到课程表
        let table = document.querySelector('table.courseTable');
        if (!table) {
            table = document.querySelector('.course-table table');
        }
        if (!table) {
            table = document.querySelector('#courseTable');
        }
        if (!table) {
            table = document.querySelector('table');
        }
        
        if (!table) {
            console.error('❌ 未找到课程表');
            return [];
        }
        
        console.log('🔍 开始解析课程数据...');
        
        // 获取星期映射
        const headers = Array.from(table.querySelectorAll('thead th'));
        const weekdayMap = {};
        const weekdays = ['', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六', '星期日'];
        
        headers.forEach((th, index) => {
            const text = th.textContent.trim();
            for (let i = 1; i <= 7; i++) {
                if (text.includes(weekdays[i])) {
                    weekdayMap[index] = i;
                    break;
                }
            }
        });
        
        console.log('📅 星期映射：', weekdayMap);
        
        // 解析课程单元格
        const courses = [];
        const courseCells = document.querySelectorAll('div.tdHtml');
        
        console.log(`📚 找到 ${courseCells.length} 个课程单元格`);
        
        courseCells.forEach(cell => {
            if (!cell.textContent.trim()) return;
            
            // 确定星期
            let weekday = 0;
            const parentTd = cell.closest('td');
            if (parentTd) {
                const parentTr = parentTd.closest('tr');
                if (parentTr) {
                    const allTds = Array.from(parentTr.querySelectorAll('td'));
                    const colIndex = allTds.indexOf(parentTd);
                    weekday = weekdayMap[colIndex] || 0;
                }
            }
            
            if (weekday === 0) return;
            
            // 解析课程信息
            const courseNames = cell.querySelectorAll('div.course-name');
            courseNames.forEach(nameDiv => {
                const courseName = nameDiv.textContent.trim().replace(/^本/, '');
                
                // 收集这门课程的所有相关信息（包括文本节点）
                let currentElement = nameDiv.nextSibling;
                const courseInfo = [];
                
                while (currentElement && !currentElement.classList?.contains('course-name')) {
                    if (currentElement.nodeType === 3) { // TEXT_NODE
                        const text = currentElement.textContent ? currentElement.textContent.trim() : '';
                        if (text) courseInfo.push(text);
                    } else if (currentElement.nodeType === 1) { // ELEMENT_NODE
                        const text = currentElement.textContent ? currentElement.textContent.trim() : '';
                        if (text && !text.match(/^[A-Z][A-Z0-9]*\.\d+$/)) { // 排除课程代码
                            courseInfo.push(text);
                        }
                    }
                    currentElement = currentElement.nextSibling;
                }
                
                // 合并所有信息为一个字符串，然后分析
                const allInfo = courseInfo.join(' ').replace(/\u00A0/g, ' '); // 替换&nbsp;为普通空格
                console.log(`课程 "${courseName}" 的原始信息:`, courseInfo);
                console.log(`课程 "${courseName}" 的合并信息:`, allInfo);
                
                // 先尝试简单的正则匹配来调试
                const weekMatches = allInfo.match(/\((\d+)~(\d+)周\)/g);
                const periodMatches = allInfo.match(/\((\d+-\d+节)\)/g);
                
                console.log(`课程 "${courseName}" 找到的周数匹配:`, weekMatches);
                console.log(`课程 "${courseName}" 找到的节数匹配:`, periodMatches);
                
                // 修改正则表达式，支持范围格式 (2~11周) 和单独格式 (12周)
                // 匹配格式：(数字~数字周) ... (数字-数字节) 或 (数字周) ... (数字-数字节)
                const timePattern = /\((\d+)(?:~(\d+))?周\)[^(]*?\((\d+)-(\d+)节\)/g;
                let timeMatch;
                let matchCount = 0;
                
                // 重置正则表达式
                timePattern.lastIndex = 0;
                
                while ((timeMatch = timePattern.exec(allInfo)) !== null) {
                    matchCount++;
                    console.log(`第 ${matchCount} 个匹配:`, timeMatch);
                    
                    const weekStart = timeMatch[1];  // 起始周
                    const weekEnd = timeMatch[2] || timeMatch[1];  // 结束周，如果没有范围则等于起始周
                    const periodStart = parseInt(timeMatch[3]);
                    const periodEnd = parseInt(timeMatch[4]);
                    
                    console.log(`原始周数值: weekStart="${weekStart}", weekEnd="${weekEnd}"`);
                    
                    // 获取这个时间段后面的信息（地点和老师）
                    const matchEndIndex = timeMatch.index + timeMatch[0].length;
                    const remainingText = allInfo.substring(matchEndIndex);
                    
                    // 提取到下一个括号或字符串结束的部分
                    const nextTimeMatch = remainingText.search(/\(\d+~\d+周\)/);
                    const infoText = nextTimeMatch === -1 ? remainingText : remainingText.substring(0, nextTimeMatch);
                    
                    console.log(`课程信息文本: "${infoText}"`);
                    
                    // 解析地点和教师
                    const parts = infoText.trim().split(/\s+/).filter(p => p.trim() && p !== '');
                    console.log(`解析得到的部分:`, parts);
                    
                    let campus = '';
                    let classroom = '';
                    let teacher = '';
                    
                    parts.forEach(part => {
                        if (part.includes('校区') && !campus) {
                            campus = part;
                        } else if ((part.startsWith('教') || part.includes('实验') || part.includes('楼')) && !classroom) {
                            classroom = part;
                        } else if (part.length <= 4 && /^[\u4e00-\u9fa5]+$/.test(part) && !teacher) {
                            teacher = part;
                        }
                    });
                    
                    const location = campus && classroom ? `${campus} ${classroom}` : 
                                   campus || classroom || '';
                    
                    // 确保周数格式正确：
                    // 如果是范围格式（如2~11），显示为 "2-11"
                    // 如果是单独格式（如12），显示为 "12"  
                    const weekStartNum = parseInt(weekStart, 10);
                    const weekEndNum = parseInt(weekEnd, 10);
                    const weekRange = weekStartNum === weekEndNum ? String(weekStartNum) : `${weekStartNum}-${weekEndNum}`;
                    
                    console.log(`最终周数: ${weekRange} (${weekStartNum} - ${weekEndNum})`);
                    
                    courses.push({
                        '课程名称': courseName,
                        '星期': weekday,
                        '开始节数': periodStart,
                        '结束节数': periodEnd,
                        '老师': teacher,
                        '地点': location,
                        '周数': weekRange
                    });
                    
                    console.log(`✅ 成功添加课程: ${courseName} - 周数: ${weekRange}, 节数: ${periodStart}-${periodEnd}, 老师: ${teacher}`);
                }
                
                if (matchCount === 0) {
                    console.warn(`⚠️ 课程 "${courseName}" 未找到任何时间匹配`);
                    // 尝试更宽松的匹配，支持单独周次格式
                    const loosePattern = /(\d+)(?:~(\d+))?周/g;
                    const looseMatches = [];
                    let looseMatch;
                    while ((looseMatch = loosePattern.exec(allInfo)) !== null) {
                        looseMatches.push({
                            weekStart: looseMatch[1],
                            weekEnd: looseMatch[2] || looseMatch[1],
                            match: looseMatch[0]
                        });
                    }
                    console.log(`宽松匹配结果:`, looseMatches);
                }
            });
        });
        
        console.log(`✅ 解析完成，找到 ${courses.length} 条课程记录`);
        return courses;
    }
    
    // 3. 生成CSV
    function generateCSV(courses) {
        if (!courses || courses.length === 0) {
            console.warn('⚠️ 没有课程数据可导出');
            return;
        }
        
        // 在生成CSV前，检查一下数据
        console.log('📝 生成CSV前检查数据:');
        courses.slice(0, 3).forEach((course, index) => {
            console.log(`课程 ${index + 1}: ${course.课程名称} - 周数: "${course.周数}" (类型: ${typeof course.周数})`);
        });
        
        // 按时间排序
        courses.sort((a, b) => {
            if (a.星期 !== b.星期) return a.星期 - b.星期;
            return a.开始节数 - b.开始节数;
        });
        
        // 生成CSV内容 - 不使用引号包装，直接输出
        const headers = ['课程名称', '星期', '开始节数', '结束节数', '老师', '地点', '周数'];
        const csvRows = [headers.join(',')];
        
        courses.forEach(course => {
            const row = headers.map(header => {
                let value = course[header];
                // 确保周数字段不被错误转换
                if (header === '周数' && value) {
                    // 强制保持字符串格式
                    value = String(value);
                    console.log(`处理周数字段: "${value}"`);
                }
                // 如果值包含逗号、引号或换行符，才用引号包装
                if (value && (value.toString().includes(',') || value.toString().includes('"') || value.toString().includes('\n'))) {
                    return `"${String(value).replace(/"/g, '""')}"`;
                } else {
                    return value || '';
                }
            });
            csvRows.push(row.join(','));
        });
        
        const csvContent = csvRows.join('\n');
        
        // 添加调试：检查生成的CSV内容
        console.log('📄 生成的CSV内容预览:');
        console.log(csvContent.split('\n').slice(0, 5).join('\n'));
        
        // 下载CSV
        const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'courses.csv';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        console.log('📊 CSV文件下载完成：courses.csv');
        return csvContent;
    }
    
    // 4. 显示结果摘要
    function showSummary(courses) {
        if (!courses || courses.length === 0) return;
        
        console.log('\n📋 课程表摘要：');
        console.log('='.repeat(50));
        
        const weekdays = ['', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六', '星期日'];
        
        courses.forEach((course, index) => {
            const weekdayName = weekdays[course.星期] || '未知';
            console.log(`${index + 1}. ${course.课程名称}`);
            console.log(`   时间：${weekdayName} ${course.开始节数}-${course.结束节数}节`);
            console.log(`   周数：${course.周数}`);
            console.log(`   地点：${course.地点 || '未知'}`);
            console.log(`   老师：${course.老师 || '未知'}`);
            console.log('-'.repeat(30));
        });
        
        console.log(`\n✅ 总计：${courses.length} 门课程`);
    }
    
    // 调试信息显示
    function showDebugInfo() {
        console.log('=== 调试信息 ===');
        console.log('当前URL:', window.location.href);
        console.log('页面标题:', document.title);
        
        // 检查JavaScript全局变量
        console.log('JavaScript变量:');
        console.log('- semesterId:', window.semesterId);
        console.log('- currentSemester:', window.currentSemester);
        console.log('- dataId:', window.dataId);
        console.log('- personId:', window.personId);
        console.log('- studentId:', window.studentId);
        
        // 查找所有可能的学期选择器
        const semesterElements = document.querySelectorAll('select, [id*="semester"], [class*="semester"]');
        console.log('找到的学期相关元素:', semesterElements);
        
        // 查找所有可能的学生ID元素
        const studentElements = document.querySelectorAll('[id*="student"], [name*="student"], [data-student]');
        console.log('找到的学生相关元素:', studentElements);
        
        // 显示当前获取的信息
        const semester = getCurrentSemester();
        const studentAssoc = getStudentAssoc();
        console.log('当前获取结果:', { semester, studentAssoc });
        
        let debugInfo = `调试信息:\n`;
        debugInfo += `当前URL: ${window.location.href}\n`;
        debugInfo += `学期ID: ${window.semesterId || '未找到'}\n`;
        debugInfo += `数据ID: ${window.dataId || '未找到'}\n`;
        debugInfo += `人员ID: ${window.personId || '未找到'}\n`;
        debugInfo += `获取结果:\n`;
        debugInfo += `- 学期: ${semester ? semester.value : '未找到'}\n`;
        debugInfo += `- 学生ID: ${studentAssoc || '未找到'}\n`;
        debugInfo += `\n页面课程表元素检测:\n`;
        debugInfo += `- .export-content: ${document.querySelector('.export-content') ? '找到' : '未找到'}\n`;
        debugInfo += `- table.courseTable: ${document.querySelector('table.courseTable') ? '找到' : '未找到'}\n`;
        debugInfo += `- .course-table: ${document.querySelector('.course-table') ? '找到' : '未找到'}\n`;
        debugInfo += `- #courseTable: ${document.querySelector('#courseTable') ? '找到' : '未找到'}`;
        
        alert(debugInfo);
    }

    // 从当前页面解析课程表
    function parseFromCurrentPage() {
        try {
            console.log('开始从当前页面解析课程表...');
            
            // 1. 下载当前页面HTML
            const html = downloadHTML();
            if (!html) return;
            
            // 2. 解析课程
            const courses = parseCourseTable();
            if (courses.length === 0) {
                showNotification('未解析到任何课程数据', 'error');
                return;
            }
            
            // 3. 生成CSV
            generateCSV(courses);
            
            // 4. 显示摘要
            showSummary(courses);
            
            showNotification(`解析完成！共找到 ${courses.length} 门课程`, 'success');
            
        } catch (error) {
            console.error('解析课程表失败:', error);
            showNotification(`解析失败: ${error.message}`, 'error');
        }
    }

    // 一键处理：获取HTML + 解析CSV
    async function processAllInOne() {
        try {
            showNotification('开始一键处理...', 'info');
            console.log('开始一键处理：获取HTML + 解析CSV');
            
            // 1. 先尝试通过API获取HTML
            const htmlContent = await downloadCourseTable();
            
            if (htmlContent) {
                // 2. 创建临时DOM元素来解析HTML
                const tempDiv = document.createElement('div');
                tempDiv.innerHTML = htmlContent;
                
                // 3. 在临时DOM中查找课程表并解析
                const courses = parseCourseTableFromHTML(tempDiv);
                
                if (courses.length > 0) {
                    // 4. 生成CSV
                    generateCSV(courses);
                    showSummary(courses);
                    showNotification(`一键处理完成！共找到 ${courses.length} 门课程`, 'success');
                } else {
                    showNotification('未能从获取的HTML中解析到课程数据', 'error');
                }
            } else {
                // 如果API获取失败，尝试从当前页面解析
                console.log('API获取失败，尝试从当前页面解析...');
                parseFromCurrentPage();
            }
            
        } catch (error) {
            console.error('一键处理失败:', error);
            showNotification(`一键处理失败: ${error.message}`, 'error');
        }
    }

    // 从HTML字符串中解析课程表
    function parseCourseTableFromHTML(container) {
        console.log('🔍 开始从HTML内容解析课程数据...');
        
        // 尝试多种方式找到课程表
        let table = container.querySelector('table.courseTable');
        if (!table) {
            table = container.querySelector('.course-table table');
        }
        if (!table) {
            table = container.querySelector('#courseTable');
        }
        if (!table) {
            table = container.querySelector('table');
        }
        
        if (!table) {
            console.error('❌ 在HTML内容中未找到课程表');
            return [];
        }
        
        console.log('📋 找到课程表，开始解析...');
        
        // 获取星期映射
        const headers = Array.from(table.querySelectorAll('thead th'));
        const weekdayMap = {};
        const weekdays = ['', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六', '星期日'];
        
        headers.forEach((th, index) => {
            const text = th.textContent.trim();
            for (let i = 1; i <= 7; i++) {
                if (text.includes(weekdays[i])) {
                    weekdayMap[index] = i;
                    break;
                }
            }
        });
        
        console.log('📅 星期映射：', weekdayMap);
        
        // 解析课程单元格
        const courses = [];
        const courseCells = table.querySelectorAll('div.tdHtml');
        
        console.log(`📚 找到 ${courseCells.length} 个课程单元格`);
        
        courseCells.forEach(cell => {
            if (!cell.textContent.trim()) return;
            
            // 确定星期
            let weekday = 0;
            const parentTd = cell.closest('td');
            if (parentTd) {
                const parentTr = parentTd.closest('tr');
                if (parentTr) {
                    const allTds = Array.from(parentTr.querySelectorAll('td'));
                    const colIndex = allTds.indexOf(parentTd);
                    weekday = weekdayMap[colIndex] || 0;
                }
            }
            
            if (weekday === 0) return;
            
            // 解析课程信息
            const courseNames = cell.querySelectorAll('div.course-name');
            courseNames.forEach(nameDiv => {
                const courseName = nameDiv.textContent.trim().replace(/^本/, '');
                
                // 收集这门课程的所有相关信息
                let currentElement = nameDiv.nextSibling;
                const courseInfo = [];
                
                while (currentElement && !currentElement.classList?.contains('course-name')) {
                    if (currentElement.nodeType === 3) { // TEXT_NODE
                        const text = currentElement.textContent ? currentElement.textContent.trim() : '';
                        if (text) courseInfo.push(text);
                    } else if (currentElement.nodeType === 1) { // ELEMENT_NODE
                        const text = currentElement.textContent ? currentElement.textContent.trim() : '';
                        if (text && !text.match(/^[A-Z][A-Z0-9]*\.\d+$/)) {
                            courseInfo.push(text);
                        }
                    }
                    currentElement = currentElement.nextSibling;
                }
                
                const allInfo = courseInfo.join(' ').replace(/\u00A0/g, ' ');
                console.log(`课程 "${courseName}" 的信息:`, allInfo);
                
                // 解析时间信息
                const timePattern = /\((\d+)(?:~(\d+))?周\)[^(]*?\((\d+)-(\d+)节\)/g;
                let timeMatch;
                
                while ((timeMatch = timePattern.exec(allInfo)) !== null) {
                    const weekStart = timeMatch[1];
                    const weekEnd = timeMatch[2] || timeMatch[1];
                    const periodStart = parseInt(timeMatch[3]);
                    const periodEnd = parseInt(timeMatch[4]);
                    
                    // 获取地点和老师信息
                    const matchEndIndex = timeMatch.index + timeMatch[0].length;
                    const remainingText = allInfo.substring(matchEndIndex);
                    const nextTimeMatch = remainingText.search(/\(\d+~\d+周\)/);
                    const infoText = nextTimeMatch === -1 ? remainingText : remainingText.substring(0, nextTimeMatch);
                    
                    const parts = infoText.trim().split(/\s+/).filter(p => p.trim() && p !== '');
                    
                    let campus = '';
                    let classroom = '';
                    let teacher = '';
                    
                    parts.forEach(part => {
                        if (part.includes('校区') && !campus) {
                            campus = part;
                        } else if ((part.startsWith('教') || part.includes('实验') || part.includes('楼')) && !classroom) {
                            classroom = part;
                        } else if (part.length <= 4 && /^[\u4e00-\u9fa5]+$/.test(part) && !teacher) {
                            teacher = part;
                        }
                    });
                    
                    const location = campus && classroom ? `${campus} ${classroom}` : 
                                   campus || classroom || '';
                    
                    const weekStartNum = parseInt(weekStart, 10);
                    const weekEndNum = parseInt(weekEnd, 10);
                    const weekRange = weekStartNum === weekEndNum ? String(weekStartNum) : `${weekStartNum}-${weekEndNum}`;
                    
                    courses.push({
                        '课程名称': courseName,
                        '星期': weekday,
                        '开始节数': periodStart,
                        '结束节数': periodEnd,
                        '老师': teacher,
                        '地点': location,
                        '周数': weekRange
                    });
                    
                    console.log(`✅ 成功添加课程: ${courseName} - 周数: ${weekRange}, 节数: ${periodStart}-${periodEnd}`);
                }
            });
        });
        
        console.log(`✅ 解析完成，找到 ${courses.length} 条课程记录`);
        return courses;
    }
    
    // 主执行函数（保持向后兼容）
    function main() {
        parseFromCurrentPage();
    }
    
    // 初始化函数
    function init() {
        // 检查页面是否包含课程表
        const hasTable = document.querySelector('table.courseTable') || 
                         document.querySelector('.course-table') || 
                         document.querySelector('#courseTable') ||
                         document.querySelector('.export-content');
        
        if (hasTable) {
            console.log('✅ 检测到课程表页面');
            addControlButtons();
        } else {
            console.log('ℹ️ 未检测到课程表，等待页面加载...');
            // 等待页面完全加载后再次检查
            setTimeout(() => {
                const hasTableLater = document.querySelector('table.courseTable') || 
                                    document.querySelector('.course-table') || 
                                    document.querySelector('#courseTable') ||
                                    document.querySelector('.export-content');
                if (hasTableLater) {
                    console.log('✅ 延迟检测到课程表页面');
                    addControlButtons();
                }
            }, 2000);
        }
        
        // 添加键盘快捷键支持
        document.addEventListener('keydown', (event) => {
            // Ctrl+D 获取课程表HTML
            if (event.ctrlKey && event.key === 'd') {
                event.preventDefault();
                downloadCourseTable();
            }
            // Ctrl+P 解析生成CSV
            if (event.ctrlKey && event.key === 'p') {
                event.preventDefault();
                parseFromCurrentPage();
            }
            // Ctrl+A 一键处理
            if (event.ctrlKey && event.key === 'a') {
                event.preventDefault();
                processAllInOne();
            }
        });
        
        // 显示初始化完成提示
        setTimeout(() => {
            showNotification('西工大课程表工具已就绪！\n快捷键：Ctrl+D获取HTML，Ctrl+P解析CSV，Ctrl+A一键处理', 'info');
        }, 1000);
    }
    
    // 等待DOM加载完成后初始化
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
    
})();