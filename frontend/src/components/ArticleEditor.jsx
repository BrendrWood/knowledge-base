import { useState, useEffect, useRef } from 'react';
import { Editor } from '@tinymce/tinymce-react';
import api from '../api';
import './ArticleEditor.css';

function ArticleEditor({ 
  isOpen, 
  onClose, 
  title, 
  setTitle, 
  content, 
  setContent, 
  onSave, 
  onUndo,
  articleId,
  mode 
}) {
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [tags, setTags] = useState([]);
  const [tagInput, setTagInput] = useState('');
  const [availableTags, setAvailableTags] = useState([]);
  const originalTitleRef = useRef(title);
  const originalContentRef = useRef(content);
  const originalTagsRef = useRef([]);
  const editorRef = useRef(null);
  const overlayMouseDownRef = useRef(false);

  const undoKey = articleId ? `undo_${articleId}_${mode}` : null;

  // Загружаем теги статьи + все доступные теги
  useEffect(() => {
    if (isOpen && articleId) {
      loadArticleData();
      loadAvailableTags();
    }
  }, [isOpen, articleId]);

  const loadArticleData = async () => {
    try {
      const response = await api.get(`/articles/${articleId}`);
      const articleTags = Array.isArray(response.data.tags) ? response.data.tags : [];
      setTags(articleTags);
      originalTagsRef.current = articleTags;
    } catch (error) {
      console.error('Ошибка загрузки тегов:', error);
    }
  };

  const loadAvailableTags = async () => {
    try {
      const response = await api.get('/articles/tags/all');
      setAvailableTags(response.data);
    } catch (error) {
      console.error('Ошибка загрузки доступных тегов:', error);
    }
  };

  useEffect(() => {
    if (isOpen) {
      originalTitleRef.current = title;
      originalContentRef.current = content;
      setHasChanges(false);
    }
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) {
      const tagsChanged = JSON.stringify([...tags].sort()) !== JSON.stringify([...originalTagsRef.current].sort());
      const changed = title !== originalTitleRef.current || content !== originalContentRef.current || tagsChanged;
      setHasChanges(changed);
    }
  }, [title, content, tags, isOpen]);

  // Горячие клавиши на уровне документа
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && (e.key === 's' || e.key === 'S' || e.code === 'KeyS')) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        handleSave();
        return false;
      }
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'z' || e.key === 'Z' || e.code === 'KeyZ')) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        if (localStorage.getItem(undoKey)) handleUndo();
        return false;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        handleClose();
        return false;
      }
    };

    document.addEventListener('keydown', handleKeyDown, true);
    return () => document.removeEventListener('keydown', handleKeyDown, true);
  }, [isOpen, title, content, tags, saving]);

  // --- ТЕГИ ---
  const addTag = (tag) => {
    const cleanTag = tag.trim();
    if (!cleanTag) return;
    if (tags.includes(cleanTag)) {
      setTagInput('');
      return;
    }
    setTags([...tags, cleanTag]);
    setTagInput('');
  };

  const removeTag = (tagToRemove) => {
    setTags(tags.filter(t => t !== tagToRemove));
  };

  const handleTagKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addTag(tagInput);
    } else if (e.key === 'Backspace' && tagInput === '' && tags.length > 0) {
      removeTag(tags[tags.length - 1]);
    }
  };

  // --- СОХРАНЕНИЕ ---
  const handleSave = async () => {
    if (saving) return;
    setSaving(true);
    try {
      if (undoKey) {
        localStorage.setItem(undoKey, JSON.stringify({
          title: originalTitleRef.current,
          content: originalContentRef.current,
          tags: originalTagsRef.current,
          savedAt: new Date().toISOString(),
        }));
      }

      await onSave(tags);
      setHasChanges(false);
      setTimeout(() => {
        onClose();
      }, 300);
    } catch (error) {
      console.error('Ошибка сохранения:', error);
    } finally {
      setSaving(false);
    }
  };

  // --- UNDO ---
  const handleUndo = async () => {
    if (!undoKey) return;
    
    const undoData = localStorage.getItem(undoKey);
    if (!undoData) {
      alert('Нет сохранённой версии для отмены');
      return;
    }

    if (!confirm('Отменить последнее сохранение?\n\nСтатья вернётся к предыдущему состоянию.')) {
      return;
    }

    try {
      const parsed = JSON.parse(undoData);
      setTitle(parsed.title);
      setContent(parsed.content);
      setTags(parsed.tags || []);

      if (onUndo) {
        await onUndo({
          title: parsed.title,
          content: parsed.content,
          tags: parsed.tags || [],
        });
      }

      localStorage.removeItem(undoKey);
      
      alert('Отменено!');
      onClose();
    } catch (error) {
      console.error('Ошибка отмены:', error);
      alert('Ошибка отмены: ' + error.message);
    }
  };

  const handleClose = () => {
    if (hasChanges) {
      if (!confirm('Есть несохранённые изменения. Закрыть без сохранения?')) {
        return;
      }
    }
    onClose();
  };

  const handleImageUpload = (blobInfo) => {
    return new Promise((resolve, reject) => {
      const formData = new FormData();
      formData.append('image', blobInfo.blob(), blobInfo.filename());

      fetch('http://localhost:5000/api/upload', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
        body: formData,
      })
        .then(response => {
          if (!response.ok) throw new Error('Ошибка загрузки');
          return response.json();
        })
        .then(data => {
          if (data.location) {
            resolve(data.location);
          } else {
            reject('Не удалось получить URL картинки');
          }
        })
        .catch(error => {
          reject('Ошибка загрузки: ' + error.message);
        });
    });
  };

  const handleOverlayMouseDown = (e) => {
    overlayMouseDownRef.current = e.target === e.currentTarget;
  };

  const handleOverlayMouseUp = (e) => {
    if (e.target === e.currentTarget && overlayMouseDownRef.current) {
      handleClose();
    }
    overlayMouseDownRef.current = false;
  };

  if (!isOpen) return null;

  const hasUndo = undoKey && localStorage.getItem(undoKey);

  return (
    <div 
      className="editor-modal-overlay" 
      onMouseDown={handleOverlayMouseDown}
      onMouseUp={handleOverlayMouseUp}
    >
      <div className="editor-modal" onClick={(e) => e.stopPropagation()}>
        <div className="editor-modal-header">
          <h2>
            {mode === 'web' ? 'Редактор веб-версии' : 'Редактор мобильной версии'}
            {hasChanges && <span className="editor-unsaved-badge">не сохранено</span>}
          </h2>
          <div className="editor-header-actions">
            {hasUndo && (
              <button 
                className="editor-undo-btn"
                onClick={handleUndo}
                title="Отменить последнее сохранение (Ctrl+Shift+Z)"
              >
                ↩ Отменить
              </button>
            )}
            <button className="editor-modal-close" onClick={handleClose} title="Esc">✕</button>
          </div>
        </div>

        <div className="editor-modal-body">
          <input
            type="text"
            placeholder="Заголовок статьи"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="editor-title-input"
          />

          {/* ТЕГИ */}
          <div className="editor-tags-container">
            <div className="editor-tags-list">
              {tags.map((tag) => (
                <span key={tag} className="editor-tag">
                  {tag}
                  <button 
                    type="button"
                    className="editor-tag-remove"
                    onClick={() => removeTag(tag)}
                    title="Удалить тег"
                  >
                    ✕
                  </button>
                </span>
              ))}
              <input
                type="text"
                className="editor-tag-input"
                placeholder={tags.length === 0 ? 'Добавить теги (Enter или запятая)...' : ''}
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={handleTagKeyDown}
                onBlur={() => { if (tagInput) addTag(tagInput); }}
              />
            </div>

            {availableTags.length > 0 && tagInput.length > 0 && (
              <div className="editor-tag-suggestions">
                {availableTags
                  .filter(t => 
                    !tags.includes(t) && 
                    t.toLowerCase().includes(tagInput.toLowerCase())
                  )
                  .slice(0, 5)
                  .map(tag => (
                    <button 
                      key={tag}
                      type="button"
                      className="editor-tag-suggestion"
                      onClick={() => addTag(tag)}
                    >
                      + {tag}
                    </button>
                  ))
                }
              </div>
            )}
          </div>

          <Editor
            apiKey="ufgn9w4lb1n0b8vud6pjz8le490qc8zytyab7xaoa15exqt5"
            value={content}
            onEditorChange={(newContent) => setContent(newContent)}
            onInit={(evt, editor) => { editorRef.current = editor; }}
            init={{
              height: 500,
              menubar: true,
              plugins: [
                'advlist', 'autolink', 'lists', 'link', 'image', 'charmap', 'preview',
                'anchor', 'searchreplace', 'visualblocks', 'code', 'fullscreen',
                'insertdatetime', 'media', 'table', 'help', 'wordcount'
              ],
              toolbar: 'undo redo | blocks | ' +
                'bold italic underline strikethrough | alignleft aligncenter ' +
                'alignright alignjustify | bullist numlist outdent indent | ' +
                'removeformat | image media | help',
              image_uploadtab: true,
              images_upload_handler: handleImageUpload,
              content_style: 'body { font-family:Helvetica,Arial,sans-serif; font-size:14px }',
              setup: (editor) => {
                editor.on('keydown', (e) => {
                  if ((e.ctrlKey || e.metaKey) && (e.key === 's' || e.key === 'S' || e.keyCode === 83)) {
                    e.preventDefault();
                    e.stopPropagation();
                    e.stopImmediatePropagation();
                    handleSave();
                    return false;
                  }
                  if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'z' || e.key === 'Z' || e.keyCode === 90)) {
                    e.preventDefault();
                    e.stopPropagation();
                    e.stopImmediatePropagation();
                    if (hasUndo) handleUndo();
                    return false;
                  }
                  if (e.key === 'Escape' || e.keyCode === 27) {
                    e.preventDefault();
                    e.stopPropagation();
                    handleClose();
                    return false;
                  }
                });
              },
            }}
          />
        </div>

        <div className="editor-modal-footer">
          <div className="editor-hotkeys-hint">
            <span><kbd>Ctrl</kbd>+<kbd>S</kbd> — сохранить</span>
            {hasUndo && <span><kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>Z</kbd> — отменить</span>}
            <span><kbd>Esc</kbd> — закрыть</span>
          </div>
          <div className="editor-footer-actions">
            <button className="editor-btn-cancel" onClick={handleClose} disabled={saving}>
              Отмена
            </button>
            <button 
              className="editor-btn-save" 
              onClick={handleSave}
              disabled={saving || !hasChanges}
            >
              {saving ? (
                <>
                  <span className="editor-spinner"></span>
                  Сохранение...
                </>
              ) : (
                '💾 Сохранить'
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ArticleEditor;