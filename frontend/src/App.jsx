import { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import api from './api';
import ArticleEditor from './components/ArticleEditor';
import ShareLinkCreator from './components/ShareLinkCreator';
import SharedLinksTable from './components/SharedLinksTable';
import DoomsdayButton from './components/DoomsdayButton';
import ExpiringLinksBanner from './components/ExpiringLinksBanner';
import { useTheme } from './context/ThemeContext';
import './App.css';

// Компонент дерева с поддержкой поиска и тегов
function TreeNode({ 
  node, 
  onSelect, 
  onDelete, 
  onAddChild, 
  onTagClick,
  selectedId, 
  level = 0, 
  searchQuery = '', 
  searchMode = 'title',
  activeTag = null,
}) {
  const [isOpen, setIsOpen] = useState(true);
  const [isHovered, setIsHovered] = useState(false);
  const hasChildren = node.children && node.children.length > 0;
  const paddingLeft = level * 12;

  const nodeTags = Array.isArray(node.tags) ? node.tags : [];

  const matchesTag = !activeTag || nodeTags.includes(activeTag);

  const isTitleMatch = searchQuery && searchQuery.length >= 3 && 
    node.title.toLowerCase().includes(searchQuery.toLowerCase());

  const isContentMatch = searchQuery && searchQuery.length >= 3 && 
    searchMode === 'content' && (
      (node.content_web && node.content_web.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (node.content_mobile && node.content_mobile.toLowerCase().includes(searchQuery.toLowerCase()))
    );

  const isTagMatch = searchQuery && searchQuery.length >= 3 && searchMode === 'content' &&
    nodeTags.some(t => t.toLowerCase().includes(searchQuery.toLowerCase()));

  const isMatch = isTitleMatch || isContentMatch || isTagMatch;
  
  const hasMatchingChild = (node, query, mode, tag) => {
    if (node.children && node.children.length > 0) {
      return node.children.some(child => {
        const childTags = Array.isArray(child.tags) ? child.tags : [];
        const childMatchesTag = !tag || childTags.includes(tag);
        if (!childMatchesTag) return hasMatchingChild(child, query, mode, tag);
        
        if (!query || query.length < 3) return true;
        const childTitleMatch = child.title.toLowerCase().includes(query.toLowerCase());
        const childContentMatch = mode === 'content' && (
          (child.content_web && child.content_web.toLowerCase().includes(query.toLowerCase())) ||
          (child.content_mobile && child.content_mobile.toLowerCase().includes(query.toLowerCase()))
        );
        const childTagMatch = mode === 'content' && childTags.some(t => t.toLowerCase().includes(query.toLowerCase()));
        return (childTitleMatch || childContentMatch || childTagMatch) || hasMatchingChild(child, query, mode, tag);
      });
    }
    return false;
  };

  const hasSearchQuery = searchQuery && searchQuery.length >= 3;
  
  let shouldShow = true;
  if (hasSearchQuery) {
    shouldShow = isMatch || hasMatchingChild(node, searchQuery, searchMode, activeTag);
  } else if (activeTag) {
    shouldShow = matchesTag || hasMatchingChild(node, '', 'title', activeTag);
  }

  if (!shouldShow) {
    return null;
  }

  const highlightText = (text, query) => {
    if (!query || query.length < 3 || !text) return text;
    const lowerText = text.toLowerCase();
    const lowerQuery = query.toLowerCase();
    const index = lowerText.indexOf(lowerQuery);
    if (index === -1) return text;
    return (
      <>
        {text.substring(0, index)}
        <span className="search-highlight">{text.substring(index, index + query.length)}</span>
        {text.substring(index + query.length)}
      </>
    );
  };

  return (
    <div 
      className="tree-node" 
      style={{ paddingLeft: `${paddingLeft}px` }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className="tree-item">
        {hasChildren && (
          <button className="tree-toggle" onClick={() => setIsOpen(!isOpen)}>
            {isOpen ? '▾' : '▸'}
          </button>
        )}
        {!hasChildren && <span className="tree-toggle-placeholder">·</span>}
        
        <span 
          className={`tree-title ${selectedId === node.id ? 'active' : ''}`}
          onClick={() => onSelect(node)}
          title={node.title}
        >
          {hasSearchQuery ? highlightText(node.title, searchQuery) : node.title}
          {searchMode === 'content' && isContentMatch && !isTitleMatch && !isTagMatch && (
            <span className="search-match-badge">содержимое</span>
          )}
          {searchMode === 'content' && isTagMatch && !isTitleMatch && (
            <span className="search-match-badge">тег</span>
          )}
        </span>

        {isHovered && (
          <>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onAddChild(node.id);
              }}
              className="btn-add-child"
              title="Создать дочернюю"
            >
              +
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDelete(node.id);
              }}
              className="btn-delete-tree"
              title="Удалить"
            >
              ✕
            </button>
          </>
        )}
      </div>

      {hasChildren && isOpen && (
        <div className="tree-children">
          {node.children.map((child) => (
            <TreeNode
              key={child.id}
              node={child}
              onSelect={onSelect}
              onDelete={onDelete}
              onAddChild={onAddChild}
              onTagClick={onTagClick}
              selectedId={selectedId}
              level={level + 1}
              searchQuery={searchQuery}
              searchMode={searchMode}
              activeTag={activeTag}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ----- ГЛАВНЫЙ КОМПОНЕНТ -----
function App() {
  const navigate = useNavigate();
  const { id: urlArticleId } = useParams();
  const { theme, toggleTheme } = useTheme();
  const searchInputRef = useRef(null);
  
  const [treeData, setTreeData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedArticle, setSelectedArticle] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchMode, setSearchMode] = useState('title');
  const [currentUser, setCurrentUser] = useState(null);
  const [showDoomsday, setShowDoomsday] = useState(false);
  const [copiedArticleId, setCopiedArticleId] = useState(null);
  const [allTags, setAllTags] = useState([]);
  const [activeTag, setActiveTag] = useState(null);
  
  const [isWebEditorOpen, setIsWebEditorOpen] = useState(false);
  const [isMobileEditorOpen, setIsMobileEditorOpen] = useState(false);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [contentWeb, setContentWeb] = useState('');
  const [contentMobile, setContentMobile] = useState('');
  const [refreshLinks, setRefreshLinks] = useState(0);

  useEffect(() => {
    const user = localStorage.getItem('user');
    if (user) {
      setCurrentUser(JSON.parse(user));
    }
    loadTree();
    loadAllTags();
  }, []);

  useEffect(() => {
    if (urlArticleId && treeData.length > 0 && !selectedArticle) {
      const found = findArticleById(treeData, urlArticleId);
      if (found) {
        selectArticle(found);
      }
    }
  }, [urlArticleId, treeData]);

  useEffect(() => {
    if (searchQuery.toLowerCase().includes('doom')) {
      setShowDoomsday(true);
    }
  }, [searchQuery]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && (e.key === 'k' || e.key === 'K' || e.code === 'KeyK')) {
        e.preventDefault();
        if (searchInputRef.current) {
          searchInputRef.current.focus();
          searchInputRef.current.select();
        }
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  const findArticleById = (nodes, id) => {
    for (const node of nodes) {
      if (node.id === id) return node;
      if (node.children && node.children.length > 0) {
        const found = findArticleById(node.children, id);
        if (found) return found;
      }
    }
    return null;
  };

  const loadTree = async () => {
    try {
      const response = await api.get('/articles');
      setTreeData(response.data);
      setLoading(false);
    } catch (error) {
      console.error('Ошибка загрузки дерева:', error);
      setLoading(false);
    }
  };

  const loadAllTags = async () => {
    try {
      const response = await api.get('/articles/tags/all');
      setAllTags(response.data);
    } catch (error) {
      console.error('Ошибка загрузки тегов:', error);
    }
  };

  const handleLogout = async () => {
    if (!confirm('Выйти из системы?')) return;
    try {
      await api.post('/auth/logout');
    } catch (error) {}
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate('/login');
  };

  const handleDoomsdayDestroyed = () => {
    setTreeData([]);
    setSelectedArticle(null);
    setTitle('');
    setContentWeb('');
    setContentMobile('');
    setSearchQuery('');
    setShowDoomsday(false);
    setAllTags([]);
    setActiveTag(null);
    loadTree();
  };

  const copyArticleLink = (articleId) => {
    const link = `${window.location.origin}/article/${articleId}`;
    navigator.clipboard.writeText(link);
    setCopiedArticleId(articleId);
    setTimeout(() => setCopiedArticleId(null), 1500);
  };

  const createRootArticle = async () => {
    try {
      const response = await api.post('/articles', {
        title: 'Новая статья',
        content_web: '<p>Введите текст веб-версии...</p>',
        content_mobile: '<p>Введите текст мобильной версии...</p>',
        parentId: null,
        isPublished: false,
        tags: [],
      });
      await loadTree();
      selectArticle(response.data);
    } catch (error) {
      console.error('Ошибка создания:', error);
      alert('Ошибка создания статьи.');
    }
  };

  const createChildArticle = async (parentId) => {
    try {
      const response = await api.post('/articles', {
        title: 'Новая подстатья',
        content_web: '<p>Введите текст веб-версии...</p>',
        content_mobile: '<p>Введите текст мобильной версии...</p>',
        parentId: parentId,
        isPublished: false,
        tags: [],
      });
      await loadTree();
      selectArticle(response.data);
    } catch (error) {
      console.error('Ошибка создания дочерней:', error);
      alert('Ошибка создания дочерней статьи.');
    }
  };

  const saveArticle = async (contentKey, contentValue, tags) => {
    if (!selectedArticle) return;
    try {
      await api.put(`/articles/${selectedArticle.id}`, {
        title,
        [contentKey]: contentValue,
        tags,
      });
      
      await loadTree();
      await loadAllTags();
      
      const updatedArticle = {
        ...selectedArticle,
        title: title,
        [contentKey]: contentValue,
        tags,
      };
      setSelectedArticle(updatedArticle);
      
    } catch (error) {
      console.error('Ошибка сохранения:', error);
      alert('Ошибка сохранения.');
      throw error;
    }
  };

  const deleteArticle = async (id) => {
    try {
      const statsResponse = await api.get(`/articles/${id}/stats`);
      const stats = statsResponse.data;

      let message = `Удалить статью "${stats.articleTitle}"?\n\n`;
      
      if (stats.childArticles > 0) {
        message += `⚠️ Будет удалено ${stats.childArticles} вложенных статей.\n`;
      }
      
      if (stats.linksCount > 0) {
        message += `⚠️ Будет удалено ${stats.linksCount} активных ссылок.\n`;
      }
      
      message += '\nЭто действие НЕОБРАТИМО.';

      if (!confirm(message)) return;
    } catch (error) {
      if (!confirm('Удалить статью и все вложенные? Это действие необратимо!')) return;
    }

    try {
      await api.delete(`/articles/${id}`);
      await loadTree();
      await loadAllTags();
      if (selectedArticle?.id === id) {
        setSelectedArticle(null);
        setTitle('');
        setContentWeb('');
        setContentMobile('');
        if (urlArticleId) {
          navigate('/');
        }
      }
    } catch (error) {
      console.error('Ошибка удаления:', error);
      alert('Ошибка удаления.');
    }
  };

  const selectArticle = (article) => {
    if (!article) return;
    setSelectedArticle(article);
    setTitle(article.title);
    setContentWeb(article.content_web);
    setContentMobile(article.content_mobile);
    
    if (urlArticleId !== article.id) {
      navigate(`/article/${article.id}`, { replace: false });
    }
  };

  const openWebEditor = () => {
    if (!selectedArticle) {
      alert('Сначала выберите статью в дереве!');
      return;
    }
    setTitle(selectedArticle.title);
    setContentWeb(selectedArticle.content_web);
    setIsWebEditorOpen(true);
  };

  const openMobileEditor = () => {
    if (!selectedArticle) {
      alert('Сначала выберите статью в дереве!');
      return;
    }
    setTitle(selectedArticle.title);
    setContentMobile(selectedArticle.content_mobile);
    setIsMobileEditorOpen(true);
  };

  const saveWebEditor = async (tags) => {
    await saveArticle('content_web', contentWeb, tags);
  };

  const saveMobileEditor = async (tags) => {
    await saveArticle('content_mobile', contentMobile, tags);
  };

  const handleTagClick = (tag) => {
    if (activeTag === tag) {
      setActiveTag(null);
    } else {
      setActiveTag(tag);
    }
  };

  if (loading) {
    return <div className="loading">Загрузка...</div>;
  }

  const selectedTags = selectedArticle && Array.isArray(selectedArticle.tags) ? selectedArticle.tags : [];

  return (
    <div className="app">
      <header className="header">
        <h1>База знаний инженера</h1>
        <div className="header-right">
          {currentUser && (
            <span className="current-user">
              {currentUser.fullName || currentUser.username}
              {currentUser.role === 'super_admin' && (
                <span className="user-role-badge">супер</span>
              )}
            </span>
          )}
          <button 
            onClick={toggleTheme} 
            className="btn-theme"
            title={theme === 'light' ? 'Тёмная тема' : 'Светлая тема'}
          >
            {theme === 'light' ? '🌙' : '☀️'}
          </button>
          <button onClick={() => navigate('/audit-logs')} className="btn-users">
            История
          </button>
          <button onClick={() => navigate('/dashboard')} className="btn-users">
            Статистика
          </button>
          {currentUser?.role === 'super_admin' && (
            <button onClick={() => navigate('/users')} className="btn-users">
              Пользователи
            </button>
          )}
          {currentUser?.role === 'super_admin' && showDoomsday && (
            <DoomsdayButton onDestroyed={handleDoomsdayDestroyed} />
          )}
          <button onClick={createRootArticle} className="btn-create">
            + Новая статья
          </button>
          <button onClick={handleLogout} className="btn-logout">
            Выйти
          </button>
        </div>
      </header>

      <ExpiringLinksBanner />

      <div className="container">
        <div className="sidebar">
          <h3>Дерево статей</h3>
          
          <div className="search-container">
            <div className="search-input-wrap">
              <input
                ref={searchInputRef}
                type="text"
                className="search-input"
                placeholder={searchMode === 'title' ? 'Поиск по заголовкам...' : 'Поиск по содержимому и тегам...'}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                title="Ctrl+K для быстрого поиска"
              />
              {searchQuery && (
                <button 
                  className="search-clear"
                  onClick={() => {
                    setSearchQuery('');
                    setShowDoomsday(false);
                  }}
                  title="Очистить поиск"
                >
                  ✕
                </button>
              )}
            </div>
            
            <div className="search-mode-toggle">
              <button 
                className={`search-mode-btn ${searchMode === 'title' ? 'active' : ''}`}
                onClick={() => setSearchMode('title')}
              >
                Заголовки
              </button>
              <button 
                className={`search-mode-btn ${searchMode === 'content' ? 'active' : ''}`}
                onClick={() => setSearchMode('content')}
              >
                Содержимое
              </button>
            </div>
          </div>

          {allTags.length > 0 && (
            <div className="tag-filter-bar">
              {allTags.map(tag => (
                <button
                  key={tag}
                  className={`tag-filter-chip ${activeTag === tag ? 'active' : ''}`}
                  onClick={() => handleTagClick(tag)}
                  title={activeTag === tag ? 'Снять фильтр' : `Фильтр по тегу "${tag}"`}
                >
                  {tag}
                </button>
              ))}
            </div>
          )}
          
          {searchQuery && searchQuery.length < 3 && searchQuery.length > 0 && !searchQuery.toLowerCase().includes('doom') && (
            <p className="search-hint">Введите минимум 3 символа для поиска</p>
          )}

          {treeData.length === 0 ? (
            <p className="empty">Нет статей. Создайте первую!</p>
          ) : (
            <div className="tree-root">
              {treeData.map((node) => (
                <TreeNode
                  key={node.id}
                  node={node}
                  onSelect={selectArticle}
                  onDelete={deleteArticle}
                  onAddChild={createChildArticle}
                  onTagClick={handleTagClick}
                  selectedId={selectedArticle?.id}
                  searchQuery={searchQuery}
                  searchMode={searchMode}
                  activeTag={activeTag}
                />
              ))}
            </div>
          )}
        </div>

        <div className="editor-wrapper">
          <div className="web-editor">
            <h3>Веб-версия</h3>
            {selectedArticle ? (
              <>
                <div className="preview-header">
                  <span className="preview-title">{selectedArticle.title}</span>
                  <div className="preview-header-actions">
                    <button 
                      className={`btn-copy-article-link ${copiedArticleId === selectedArticle.id ? 'copied' : ''}`}
                      onClick={() => copyArticleLink(selectedArticle.id)}
                      title="Скопировать прямую ссылку"
                    >
                      {copiedArticleId === selectedArticle.id ? '✓ Скопировано' : '🔗 Ссылка'}
                    </button>
                    <button 
                      className="btn-print-pdf"
                      onClick={() => window.open(`/print/${selectedArticle.id}?mode=web`, '_blank')}
                      title="Скачать PDF"
                    >
                      📄 PDF
                    </button>
                  </div>
                </div>

                {selectedTags.length > 0 && (
                  <div className="preview-tags">
                    {selectedTags.map(tag => (
                      <span 
                        key={tag}
                        className={`preview-tag ${activeTag === tag ? 'active' : ''}`}
                        onClick={() => handleTagClick(tag)}
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                )}

                <div 
                  className="preview-content"
                  dangerouslySetInnerHTML={{ __html: selectedArticle.content_web }}
                />
                <div className="editor-actions">
                  <button onClick={openWebEditor} className="btn-edit">
                    Редактировать
                  </button>
                  <button onClick={() => setIsShareModalOpen(true)} className="btn-share">
                    Создать ссылку
                  </button>
                </div>
                <div className="shared-links-section">
                  <SharedLinksTable 
                    key={refreshLinks}
                    articleId={selectedArticle?.id} 
                  />
                </div>
              </>
            ) : (
              <p className="empty">Выберите статью в дереве</p>
            )}
          </div>

          <div className="mobile-preview">
            <h3>Мобильная версия</h3>
            {selectedArticle ? (
              <>
                <div className="mobile-frame">
                  <div className="mobile-content">
                    <div 
                      className="preview-content mobile-preview-text"
                      dangerouslySetInnerHTML={{ __html: selectedArticle.content_mobile }}
                    />
                  </div>
                </div>
                <button onClick={openMobileEditor} className="btn-edit">
                  Редактировать
                </button>
              </>
            ) : (
              <p className="empty">Выберите статью в дереве</p>
            )}
          </div>
        </div>
      </div>

      <ArticleEditor
        isOpen={isWebEditorOpen}
        onClose={() => setIsWebEditorOpen(false)}
        title={title}
        setTitle={setTitle}
        content={contentWeb}
        setContent={setContentWeb}
        onSave={saveWebEditor}
        onUndo={async (undoData) => {
          await api.put(`/articles/${selectedArticle.id}`, {
            title: undoData.title,
            content_web: undoData.content,
            tags: undoData.tags || [],
          });
          await loadTree();
          await loadAllTags();
          const updated = { 
            ...selectedArticle, 
            title: undoData.title, 
            content_web: undoData.content,
            tags: undoData.tags || [],
          };
          setSelectedArticle(updated);
        }}
        articleId={selectedArticle?.id}
        mode="web"
      />

      <ArticleEditor
        isOpen={isMobileEditorOpen}
        onClose={() => setIsMobileEditorOpen(false)}
        title={title}
        setTitle={setTitle}
        content={contentMobile}
        setContent={setContentMobile}
        onSave={saveMobileEditor}
        onUndo={async (undoData) => {
          await api.put(`/articles/${selectedArticle.id}`, {
            title: undoData.title,
            content_mobile: undoData.content,
            tags: undoData.tags || [],
          });
          await loadTree();
          await loadAllTags();
          const updated = { 
            ...selectedArticle, 
            title: undoData.title, 
            content_mobile: undoData.content,
            tags: undoData.tags || [],
          };
          setSelectedArticle(updated);
        }}
        articleId={selectedArticle?.id}
        mode="mobile"
      />

      {isShareModalOpen && selectedArticle && (
        <div className="share-modal-overlay" onClick={() => setIsShareModalOpen(false)}>
          <div className="share-modal" onClick={(e) => e.stopPropagation()}>
            <div className="share-modal-header">
              <h2>Создание ссылки</h2>
              <button className="share-modal-close" onClick={() => setIsShareModalOpen(false)}>✕</button>
            </div>
            <div className="share-modal-body">
              <ShareLinkCreator 
                articleId={selectedArticle.id}
                onClose={() => setIsShareModalOpen(false)}
                onLinkCreated={() => {
                  setIsShareModalOpen(false);
                  setRefreshLinks(prev => prev + 1);
                }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;