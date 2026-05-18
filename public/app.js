(function () {
    'use strict';

    const searchForm = document.getElementById('searchForm');
    const searchInput = document.getElementById('searchInput');
    const resultsContainer = document.getElementById('resultsContainer');
    const resultsCount = document.getElementById('resultsCount');
    const loadingSpinner = document.getElementById('loadingSpinner');
    const sortSelect = document.getElementById('sortSelect');
    const langSelect = document.getElementById('langSelect');

    let allResults = [];
    let currentLang = localStorage.getItem('repoFinderLang') || 'en';
    let uiTranslations = {};

    const UI_STRINGS = {
        en: {
            title: 'Repo Finder',
            subtitle: 'Search repositories across GitHub, GitLab & Bitbucket',
            searchPlaceholder: 'Enter repository name to search...',
            searchBtn: 'Search',
            resultsCount: '0 results',
            sortByStars: 'Sort by Stars',
            sortByName: 'Sort by Name',
            sortByUpdated: 'Sort by Updated',
            emptyState: 'Type a repository name in the search box above.',
            noResults: 'No results found. Try a different search term.',
            searching: 'Searching...',
            noSource: 'Please select at least one source.',
            error: 'An error occurred: ',
            footer: 'Repo Finder - Open source repository search engine'
        },
        tr: {
            title: 'Repo Bulucu',
            subtitle: 'GitHub, GitLab ve Bitbucket\'ta repo ara',
            searchPlaceholder: 'Aramak istediğiniz repo adını yazın...',
            searchBtn: 'Ara',
            resultsCount: '0 sonuç',
            sortByStars: 'Yıldıza Göre Sırala',
            sortByName: 'İsme Göre Sırala',
            sortByUpdated: 'Güncellenme',
            emptyState: 'Yukarıdaki kutuya aramak istediğiniz reponun adını yazın.',
            noResults: 'Sonuç bulunamadı. Farklı bir arama terimi deneyin.',
            searching: 'Aranıyor...',
            noSource: 'Lütfen en az bir kaynak seçin.',
            error: 'Bir hata oluştu: ',
            footer: 'Repo Bulucu - Açık kaynak repo arama motoru'
        }
    };

    langSelect.value = currentLang;

    searchForm.addEventListener('submit', function (e) {
        e.preventDefault();
        const query = searchInput.value.trim();
        if (!query) return;
        searchRepos(query);
    });

    sortSelect.addEventListener('change', function () {
        renderResults(allResults);
    });

    langSelect.addEventListener('change', function () {
        currentLang = langSelect.value;
        localStorage.setItem('repoFinderLang', currentLang);
        applyLanguage();
    });

    async function applyLanguage() {
        const strings = UI_STRINGS[currentLang] || UI_STRINGS['en'];

        document.querySelectorAll('[data-i18n]').forEach(function (el) {
            const key = el.getAttribute('data-i18n');
            if (strings[key]) {
                el.textContent = strings[key];
            }
        });

        document.querySelectorAll('[data-i18n-placeholder]').forEach(function (el) {
            const key = el.getAttribute('data-i18n-placeholder');
            if (strings[key]) {
                el.setAttribute('placeholder', strings[key]);
            }
        });

        document.querySelectorAll('[data-i18n-value]').forEach(function (el) {
            const key = el.getAttribute('data-i18n-value');
            if (strings[key]) {
                el.value = strings[key];
            }
        });

        document.documentElement.lang = currentLang;

        if (allResults.length > 0) {
            renderResults(allResults);
        }
    }

    async function translateText(text, to) {
        try {
            const res = await fetch('/api/translate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text, to })
            });
            const data = await res.json();
            return data.translated || text;
        } catch (e) {
            return text;
        }
    }

    async function searchRepos(query) {
        allResults = [];
        showLoading(true);
        resultsContainer.innerHTML = '';

        const sources = [];
        document.querySelectorAll('.source-filter:checked').forEach(function (cb) {
            sources.push(cb.value);
        });

        if (sources.length === 0) {
            showLoading(false);
            resultsContainer.innerHTML = '<div class="empty-state"><p>' + getUI('noSource') + '</p></div>';
            return;
        }

        try {
            const promises = [];
            if (sources.includes('github')) {
                promises.push(fetchGitHub(query));
            }
            if (sources.includes('gitlab')) {
                promises.push(fetchGitLab(query));
            }
            if (sources.includes('bitbucket')) {
                promises.push(fetchBitbucket(query));
            }

            const results = await Promise.allSettled(promises);
            results.forEach(function (result) {
                if (result.status === 'fulfilled') {
                    allResults = allResults.concat(result.value);
                }
            });

            if (currentLang !== 'en') {
                await translateAllDescriptions();
            }

            renderResults(allResults);
        } catch (err) {
            resultsContainer.innerHTML = '<div class="empty-state"><p>' + getUI('error') + err.message + '</p></div>';
        } finally {
            showLoading(false);
        }
    }

    async function translateAllDescriptions() {
        const promises = allResults.map(async function (repo) {
            if (repo.description && repo.description.length > 0) {
                repo.translatedDescription = await translateText(repo.description, currentLang);
            }
            if (repo.language && repo.language.length > 0) {
                repo.translatedLanguage = await translateText(repo.language, currentLang);
            }
        });
        await Promise.allSettled(promises);
    }

    async function fetchGitHub(query) {
        const url = '/api/proxy/github?q=' + encodeURIComponent(query) + '&per_page=30';
        const res = await fetch(url);
        if (!res.ok) throw new Error('GitHub API error: ' + res.status);
        const data = await res.json();
        return data.items.map(function (repo) {
            return {
                source: 'github',
                name: repo.full_name,
                url: repo.html_url,
                description: repo.description || '',
                stars: repo.stargazers_count,
                forks: repo.forks_count,
                language: repo.language || '',
                updated: repo.updated_at
            };
        });
    }

    async function fetchGitLab(query) {
        const url = '/api/proxy/gitlab?q=' + encodeURIComponent(query) + '&per_page=30';
        const res = await fetch(url);
        if (!res.ok) throw new Error('GitLab API error: ' + res.status);
        const data = await res.json();
        return data.map(function (repo) {
            return {
                source: 'gitlab',
                name: repo.path_with_namespace,
                url: repo.web_url,
                description: repo.description || '',
                stars: repo.star_count,
                forks: repo.forks_count,
                language: repo.programming_language || '',
                updated: repo.last_activity_at
            };
        });
    }

    async function fetchBitbucket(query) {
        const url = '/api/proxy/bitbucket?q=' + encodeURIComponent(query);
        const res = await fetch(url);
        if (!res.ok) throw new Error('Bitbucket API error: ' + res.status);
        const data = await res.json();
        return data.values.map(function (repo) {
            return {
                source: 'bitbucket',
                name: repo.full_name,
                url: repo.links.html.href,
                description: repo.description || '',
                stars: 0,
                forks: 0,
                language: repo.language || '',
                updated: repo.updated_on
            };
        });
    }

    function renderResults(results) {
        const sortBy = sortSelect.value;

        results.sort(function (a, b) {
            if (sortBy === 'stars') {
                return b.stars - a.stars;
            } else if (sortBy === 'name') {
                return a.name.localeCompare(b.name);
            } else if (sortBy === 'updated') {
                return new Date(b.updated) - new Date(a.updated);
            }
            return 0;
        });

        resultsCount.textContent = results.length + ' ' + getUI('resultsCount').replace('0 ', '');

        if (results.length === 0) {
            resultsContainer.innerHTML = '<div class="empty-state"><p>' + getUI('noResults') + '</p></div>';
            return;
        }

        let html = '';
        results.forEach(function (repo) {
            const timeAgo = getTimeAgo(repo.updated);
            const desc = repo.translatedDescription || repo.description;
            const lang = repo.translatedLanguage || repo.language;

            html += '<div class="repo-card">';
            html += '<div class="repo-card-header">';
            html += '<a href="' + repo.url + '" target="_blank" rel="noopener" class="repo-name">' + escapeHtml(repo.name) + '</a>';
            html += '<span class="repo-source source-' + repo.source + '">' + repo.source + '</span>';
            html += '</div>';
            if (desc) {
                html += '<div class="repo-description">' + escapeHtml(desc) + '</div>';
            }
            html += '<div class="repo-stats">';
            html += '<span class="repo-stat"><span class="icon">&#9733;</span> ' + repo.stars.toLocaleString() + '</span>';
            html += '<span class="repo-stat"><span class="icon">&#9711;</span> ' + repo.forks.toLocaleString() + '</span>';
            if (lang) {
                html += '<span class="repo-stat repo-language">' + escapeHtml(lang) + '</span>';
            }
            if (repo.updated) {
                html += '<span class="repo-stat">' + timeAgo + '</span>';
            }
            html += '</div>';
            html += '</div>';
        });

        resultsContainer.innerHTML = html;
    }

    function showLoading(visible) {
        if (visible) {
            loadingSpinner.classList.remove('hidden');
            resultsContainer.classList.add('hidden');
        } else {
            loadingSpinner.classList.add('hidden');
            resultsContainer.classList.remove('hidden');
        }
    }

    function getUI(key) {
        const strings = UI_STRINGS[currentLang] || UI_STRINGS['en'];
        return strings[key] || UI_STRINGS['en'][key] || key;
    }

    function getTimeAgo(dateStr) {
        if (!dateStr) return '';
        const now = new Date();
        const date = new Date(dateStr);
        const diffMs = now - date;
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMins / 60);
        const diffDays = Math.floor(diffHours / 24);
        const diffMonths = Math.floor(diffDays / 30);
        const diffYears = Math.floor(diffDays / 365);

        const labels = {
            now: currentLang === 'tr' ? 'şimdi' : 'now',
            min: currentLang === 'tr' ? 'dk önce' : 'min ago',
            hour: currentLang === 'tr' ? 'saat önce' : 'hours ago',
            day: currentLang === 'tr' ? 'gün önce' : 'days ago',
            month: currentLang === 'tr' ? 'ay önce' : 'months ago',
            year: currentLang === 'tr' ? 'yıl önce' : 'years ago'
        };

        if (diffMins < 1) return labels.now;
        if (diffMins < 60) return diffMins + ' ' + labels.min;
        if (diffHours < 24) return diffHours + ' ' + labels.hour;
        if (diffDays < 30) return diffDays + ' ' + labels.day;
        if (diffMonths < 12) return diffMonths + ' ' + labels.month;
        return diffYears + ' ' + labels.year;
    }

    function escapeHtml(text) {
        var div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    applyLanguage();
})();
