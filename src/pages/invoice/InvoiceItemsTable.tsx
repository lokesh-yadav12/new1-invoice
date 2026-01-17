import { useState, useEffect, useRef } from 'react';
import { Plus, X, Copy, Image, ChevronDown, ChevronUp, Bold, Italic, Strikethrough, Minus, Link as LinkIcon, List, ListOrdered } from 'lucide-react';
import { useAppDispatch, useAppSelector } from '../../store';
import { updateInvoiceData } from '../../store/invoiceSlice';

export default function InvoiceItemsTable() {
  const dispatch = useAppDispatch();
  const invoiceData = useAppSelector((state) => state.invoice);

  const [items, setItems] = useState(invoiceData.items);
  const [groups, setGroups] = useState(invoiceData.groups);
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [activeEditor, setActiveEditor] = useState<number | null>(null);
  const editorRefs = useRef<{ [key: number]: HTMLDivElement | null }>({});

  // Save to Redux whenever items or groups change
  useEffect(() => {
    dispatch(updateInvoiceData({
      items,
      groups,
    }));
  }, [items, groups, dispatch]);

  const addNewItem = (groupId: number | null = null) => {
    const newItem = {
      id: Date.now(),
      name: '',
      hsn: '',
      gstRate: 0,
      quantity: 0,
      rate: 0,
      amount: 0.00,
      cgst: 0.00,
      sgst: 0.00,
      total: 0.00,
      unit: 'Product',
      description: '',
      showDescription: false,
      image: null,
      showImage: false,
      groupId: groupId,
      customFields: {}
    };
    setItems([...items, newItem]);
  };

  const duplicateItem = (id: number) => {
    const itemToDuplicate = items.find(item => item.id === id);
    if (itemToDuplicate) {
      setItems([...items, { ...itemToDuplicate, id: Date.now() }]);
    }
  };

  const deleteItem = (id: number) => {
    if (items.length > 1) {
      setItems(items.filter(item => item.id !== id));
    }
  };

  const updateItem = (id: number, field: string, value: any) => {
    setItems(items.map(item => {
      if (item.id === id) {
        const updated = { ...item };

        // Handle custom fields
        if (field.startsWith('custom_')) {
          const columnName = field.replace('custom_', '');
          updated.customFields = {
            ...updated.customFields,
            [columnName]: value
          };
          return updated;
        }

        // Handle standard fields
        (updated as any)[field] = value;

        // Recalculate amount when quantity or rate changes
        if (field === 'quantity' || field === 'rate') {
          updated.amount = parseFloat(String(updated.quantity || 0)) * parseFloat(String(updated.rate || 0));
        }

        // Recalculate CGST and SGST when gstRate, quantity, or rate changes
        if (field === 'gstRate' || field === 'quantity' || field === 'rate') {
          const amount = field === 'quantity' || field === 'rate'
            ? updated.amount
            : parseFloat(String(updated.quantity || 0)) * parseFloat(String(updated.rate || 0));

          const gstRate = parseFloat(String(updated.gstRate || 0));
          const gstAmount = (amount * gstRate) / 100;

          // Split GST equally between CGST and SGST
          updated.cgst = gstAmount / 2;
          updated.sgst = gstAmount / 2;
          updated.amount = amount;
        }

        // Recalculate total
        updated.total = parseFloat(String(updated.amount || 0)) + parseFloat(String(updated.cgst || 0)) + parseFloat(String(updated.sgst || 0));

        return updated;
      }
      return item;
    }));
  };

  const toggleDescription = (id: number) => {
    setItems(items.map(item =>
      item.id === id ? { ...item, showDescription: !(item as any).showDescription } : item
    ));
    if (!(items.find(item => item.id === id) as any)?.showDescription) {
      setActiveEditor(id);
    } else {
      setActiveEditor(null);
    }
  };

  const toggleImage = (id: number) => {
    setItems(items.map(item =>
      item.id === id ? { ...item, showImage: !(item as any).showImage } : item
    ));
  };

  const handleImageUpload = (id: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        updateItem(id, 'image', e.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const addNewGroup = () => {
    if (groupName.trim()) {
      const newGroup = {
        id: Date.now(),
        name: groupName,
        isCollapsed: false
      };
      setGroups([...groups, newGroup]);
      setGroupName('');
      setShowGroupModal(false);
      addNewItem(newGroup.id);
    }
  };

  const applyFormat = (itemId: number, command: string, value: string | null = null) => {
    const editor = editorRefs.current[itemId];
    if (!editor) return;

    editor.focus();

    // Execute command
    document.execCommand(command, false, value || undefined);

    // Apply styling after command execution
    setTimeout(() => {
      // Style all lists
      const lists = editor.querySelectorAll('ul, ol');
      lists.forEach((list: Element) => {
        list.removeAttribute('style');
        if (list.tagName === 'UL') {
          list.setAttribute('style', 'list-style-type: disc !important; padding-left: 2em !important; margin: 1em 0 !important; display: block !important;');
        } else {
          list.setAttribute('style', 'list-style-type: decimal !important; padding-left: 2em !important; margin: 1em 0 !important; display: block !important;');
        }

        // Style list items
        const items = list.querySelectorAll('li');
        items.forEach((item: Element) => {
          item.setAttribute('style', 'display: list-item !important; margin: 0.25em 0 !important;');
        });
      });

      // Style links
      const links = editor.querySelectorAll('a');
      links.forEach((link: Element) => {
        link.setAttribute('target', '_blank');
        link.setAttribute('rel', 'noopener noreferrer');
        link.setAttribute('style', 'color: #7c3aed !important; text-decoration: underline !important; cursor: pointer !important;');
      });

      // Style bold
      const bolds = editor.querySelectorAll('strong, b');
      bolds.forEach((bold: Element) => {
        bold.setAttribute('style', 'font-weight: 600 !important;');
      });

      // Style italic
      const italics = editor.querySelectorAll('em, i');
      italics.forEach((italic: Element) => {
        italic.setAttribute('style', 'font-style: italic !important;');
      });

      updateItem(itemId, 'description', editor.innerHTML);
    }, 100);
  };

  const insertLink = (itemId: number) => {
    const editor = editorRefs.current[itemId];
    if (!editor) return;

    editor.focus();

    const selection = window.getSelection();
    const selectedText = selection?.toString().trim() || '';

    const url = prompt('Enter URL (e.g., https://example.com):');
    if (!url || url.trim() === '') return;

    let validUrl = url.trim();
    if (!validUrl.match(/^https?:\/\//i)) {
      validUrl = 'https://' + validUrl;
    }

    if (selectedText) {
      document.execCommand('createLink', false, validUrl);
      setTimeout(() => {
        const links = editor.querySelectorAll('a');
        links.forEach((link: Element) => {
          const anchorLink = link as HTMLAnchorElement;
          if (anchorLink.href === validUrl || link.textContent === selectedText) {
            link.setAttribute('target', '_blank');
            link.setAttribute('rel', 'noopener noreferrer');
            link.setAttribute('style', 'color: #7c3aed !important; text-decoration: underline !important; cursor: pointer !important;');
          }
        });
        updateItem(itemId, 'description', editor.innerHTML);
      }, 100);
    } else {
      const linkText = prompt('Enter link text:');
      if (!linkText || linkText.trim() === '') return;

      const linkHtml = `<a href="${validUrl}" target="_blank" rel="noopener noreferrer" style="color: #7c3aed !important; text-decoration: underline !important; cursor: pointer !important;">${linkText}</a>&nbsp;`;
      document.execCommand('insertHTML', false, linkHtml);
      updateItem(itemId, 'description', editor.innerHTML);
    }
  };

  const handleEditorInput = (itemId: number, e: React.FormEvent<HTMLDivElement>) => {
    const editor = editorRefs.current[itemId];
    if (!editor) return;

    const content = e.currentTarget.innerHTML;

    // Maintain styling
    setTimeout(() => {
      const lists = editor.querySelectorAll('ul, ol');
      lists.forEach((list: Element) => {
        if (list.tagName === 'UL') {
          list.setAttribute('style', 'list-style-type: disc !important; padding-left: 2em !important; margin: 1em 0 !important; display: block !important;');
        } else {
          list.setAttribute('style', 'list-style-type: decimal !important; padding-left: 2em !important; margin: 1em 0 !important; display: block !important;');
        }

        const items = list.querySelectorAll('li');
        items.forEach((item: Element) => {
          item.setAttribute('style', 'display: list-item !important; margin: 0.25em 0 !important;');
        });
      });
    }, 10);

    updateItem(itemId, 'description', content);
  };

  const handleEditorKeyDown = (itemId: number, e: React.KeyboardEvent<HTMLDivElement>) => {
    const editor = editorRefs.current[itemId];
    if (!editor) return;

    const selection = window.getSelection();
    if (!selection || !selection.rangeCount) return;

    // Handle Enter in lists
    if (e.key === 'Enter') {
      const range = selection.getRangeAt(0);
      let node = range.startContainer;
      let listItem = node.nodeType === 3 ? node.parentElement : node;

      while (listItem && listItem !== editor && (listItem as HTMLElement).tagName !== 'LI') {
        listItem = listItem.parentElement;
      }

      if (listItem && (listItem as HTMLElement).tagName === 'LI') {
        if (listItem.textContent?.trim() === '') {
          e.preventDefault();
          const list = listItem.parentElement;
          const p = document.createElement('p');
          p.innerHTML = '<br>';
          if (list && list.parentElement) {
            list.parentElement.insertBefore(p, list.nextSibling);
          }
          (listItem as HTMLElement).remove();
          if (list && list.children.length === 0) {
            (list as HTMLElement).remove();
          }
          const newRange = document.createRange();
          newRange.setStart(p, 0);
          newRange.collapse(true);
          selection.removeAllRanges();
          selection.addRange(newRange);
          updateItem(itemId, 'description', editor.innerHTML);
          return;
        }
      }
    }

    // Handle Tab
    if (e.key === 'Tab') {
      e.preventDefault();
      if (e.shiftKey) {
        document.execCommand('outdent');
      } else {
        document.execCommand('indent');
      }
      setTimeout(() => updateItem(itemId, 'description', editor.innerHTML), 50);
    }
  };

  const handleEditorPaste = (e: React.ClipboardEvent) => {
    e.preventDefault();

    // Get plain text from clipboard
    const text = e.clipboardData.getData('text/plain');

    // Insert as plain text to avoid formatting issues
    document.execCommand('insertText', false, text);
  };

  const toggleGroup = (groupId: number) => {
    setGroups(groups.map(group =>
      group.id === groupId ? { ...group, isCollapsed: !group.isCollapsed } : group
    ));
  };

  // Helper function to get cell value based on column configuration
  const getCellValue = (item: any, column: any) => {
    const columnNameLower = column.name.toLowerCase();
    const currencySymbol = invoiceData.currency.symbol;

    // Map column names to item properties
    if (columnNameLower === 'item') return item.name;
    if (columnNameLower === 'hsn/sac' || columnNameLower === 'hsn') return item.hsn;

    // Handle dynamic tax rate columns (GST Rate, VAT Rate, PPN Rate, etc.)
    if (columnNameLower.includes('rate') && (
      columnNameLower.includes('gst') || columnNameLower.includes('vat') ||
      columnNameLower.includes('ppn') || columnNameLower.includes('sst') ||
      columnNameLower.includes('hst') || columnNameLower.includes('tax')
    )) {
      return item.gstRate;
    }

    if (columnNameLower === 'quantity') return item.quantity;
    if (columnNameLower === 'rate') return item.rate;
    if (columnNameLower === 'amount') return `${currencySymbol}${parseFloat(String(item.amount) || '0').toFixed(2)}`;

    // Handle dynamic tax columns (CGST, SGST, IGST, VAT, PPN, SST, HST, TAX)
    if (columnNameLower === 'cgst') return `${currencySymbol}${parseFloat(String(item.cgst) || '0').toFixed(2)}`;
    if (columnNameLower === 'sgst') return `${currencySymbol}${parseFloat(String(item.sgst) || '0').toFixed(2)}`;
    if (columnNameLower === 'igst') {
      // IGST = CGST + SGST
      const igst = parseFloat(String(item.cgst) || '0') + parseFloat(String(item.sgst) || '0');
      return `${currencySymbol}${igst.toFixed(2)}`;
    }
    if (columnNameLower === 'vat' || columnNameLower === 'ppn' || columnNameLower === 'sst' ||
      columnNameLower === 'hst' || columnNameLower === 'tax') {
      // For other tax types, show combined tax (CGST + SGST)
      const totalTax = parseFloat(String(item.cgst) || '0') + parseFloat(String(item.sgst) || '0');
      return `${currencySymbol}${totalTax.toFixed(2)}`;
    }

    if (columnNameLower === 'total') return `${currencySymbol}${parseFloat(String(item.total) || '0').toFixed(2)}`;

    // Check custom fields
    if (item.customFields && item.customFields[column.name]) {
      const value = item.customFields[column.name];
      if (column.type === 'CURRENCY') {
        return `${currencySymbol}${parseFloat(String(value) || '0').toFixed(2)}`;
      }
      return value;
    }

    return ''; // Default for custom columns
  };

  // Helper function to check if column is editable
  const isColumnEditable = (column: any) => {
    return column.editable && column.type !== 'FORMULA';
  };

  // Helper function to get field name from column
  const getFieldName = (column: any) => {
    const columnNameLower = column.name.toLowerCase();
    if (columnNameLower === 'item') return 'name';
    if (columnNameLower === 'hsn/sac' || columnNameLower === 'hsn') return 'hsn';

    // Handle dynamic tax rate columns
    if (columnNameLower.includes('rate') && (
      columnNameLower.includes('gst') || columnNameLower.includes('vat') ||
      columnNameLower.includes('ppn') || columnNameLower.includes('sst') ||
      columnNameLower.includes('hst') || columnNameLower.includes('tax')
    )) {
      return 'gstRate';
    }

    if (columnNameLower === 'quantity') return 'quantity';
    if (columnNameLower === 'rate') return 'rate';

    // For custom columns, return the column name itself
    return `custom_${column.name}`;
  };

  const deleteGroup = (groupId: number) => {
    setGroups(groups.filter(group => group.id !== groupId));
    setItems(items.filter(item => item.groupId !== groupId));
  };

  // Get visible columns from Redux configuration
  const visibleColumns = invoiceData.columnConfiguration.filter(col => col.visible);

  const renderItem = (item: any, index: number) => {
    // Render cell based on column configuration
    const renderCell = (column: any, idx: number) => {
      const fieldName = getFieldName(column);
      const isEditable = isColumnEditable(column);
      const value = getCellValue(item, column);

      if (isEditable && fieldName) {
        // Render input field for editable columns
        const inputType = column.type === 'NUMBER' || column.type === 'CURRENCY' ? 'number' : 'text';

        // Get the actual value for the input
        let inputValue = '';
        if (fieldName.startsWith('custom_')) {
          const columnName = fieldName.replace('custom_', '');
          inputValue = item.customFields?.[columnName] || '';
        } else {
          inputValue = item[fieldName] || '';
        }

        return (
          <div key={column.id} className={`flex-1 ${idx === 0 ? 'flex-[2]' : ''} px-1 sm:px-1.5 md:px-2`} style={{ minWidth: '70px' }}>
            {/* Mobile: Show label above input */}
            <label className="block md:hidden text-[10px] text-gray-600 font-medium mb-1">{column.name}</label>
            <input
              type={inputType}
              value={inputValue}
              onChange={(e) => updateItem(item.id, fieldName, e.target.value)}
              placeholder={column.name}
              className="w-full text-[11px] sm:text-xs md:text-sm text-gray-900 outline-none py-0.5 sm:py-1 border-b border-transparent hover:border-gray-300 focus:border-purple-500"
            />
          </div>
        );
      } else {
        // Render read-only value for formula columns
        return (
          <div key={column.id} className={`flex-1 ${idx === 0 ? 'flex-[2]' : ''} px-1 sm:px-1.5 md:px-2`} style={{ minWidth: '70px' }}>
            {/* Mobile: Show label with value */}
            <div className="md:hidden">
              <span className="text-[10px] text-gray-600 font-medium">{column.name}: </span>
              <span className="text-[11px] sm:text-xs text-gray-900 font-medium">{value}</span>
            </div>
            {/* Desktop: Show value only */}
            <span className="hidden md:inline text-[11px] sm:text-xs md:text-sm text-gray-900">{value}</span>
          </div>
        );
      }
    };

    return (
      <div key={item.id} className="p-1.5 sm:p-2 md:p-3 lg:p-4">
        <div className="flex items-start gap-0.5 sm:gap-1 mb-1.5 sm:mb-2 md:mb-3 lg:mb-4">
          <span className="text-gray-900 font-semibold text-xs sm:text-sm md:text-base lg:text-lg">{index + 1}.</span>
          <div className="flex-1 min-w-0">
            {/* Dynamic row based on column configuration */}
            <div className="flex flex-col md:flex-row md:items-center mb-1.5 sm:mb-2 md:mb-3 lg:mb-4 gap-1.5 sm:gap-2">
              <div className="flex-1 grid grid-cols-1 md:flex md:flex-row gap-1.5 sm:gap-2">
                {visibleColumns.map((column, idx) => renderCell(column, idx))}
              </div>

              {/* Action buttons */}
              <div className="flex items-center justify-end gap-1 sm:gap-1.5 md:gap-2 md:w-12 lg:w-16 xl:w-24">
                <button
                  onClick={() => duplicateItem(item.id)}
                  className="text-gray-400 hover:text-gray-600 p-0.5 sm:p-1"
                >
                  <Copy size={13} className="sm:w-[15px] sm:h-[15px] md:w-4 md:h-4 lg:w-[18px] lg:h-[18px]" />
                </button>
                <button
                  onClick={() => deleteItem(item.id)}
                  className="text-gray-400 hover:text-red-500 p-0.5 sm:p-1"
                  disabled={items.length === 1}
                >
                  <X size={13} className="sm:w-[15px] sm:h-[15px] md:w-4 md:h-4 lg:w-[18px] lg:h-[18px]" />
                </button>
              </div>
            </div>

            {/* Description Editor */}
            {item.showDescription && (
              <div className="mb-1.5 sm:mb-2 md:mb-3">
                <div className="border border-gray-300 rounded-lg overflow-hidden bg-white">
                  <div className="bg-gray-50 border-b border-gray-300 px-1.5 sm:px-2 md:px-3 py-1.5 sm:py-2 flex items-center gap-0.5 sm:gap-1 overflow-x-auto">
                    <button
                      onClick={() => applyFormat(item.id, 'bold')}
                      className="p-0.5 sm:p-1 md:p-1.5 hover:bg-gray-200 rounded transition-colors flex-shrink-0"
                      title="Bold"
                      type="button"
                    >
                      <Bold size={14} className="sm:w-[15px] sm:h-[15px] md:w-4 md:h-4 lg:w-[18px] lg:h-[18px] text-gray-700" />
                    </button>
                    <button
                      onClick={() => applyFormat(item.id, 'italic')}
                      className="p-0.5 sm:p-1 md:p-1.5 hover:bg-gray-200 rounded transition-colors flex-shrink-0"
                      title="Italic"
                      type="button"
                    >
                      <Italic size={14} className="sm:w-[15px] sm:h-[15px] md:w-4 md:h-4 lg:w-[18px] lg:h-[18px] text-gray-700" />
                    </button>
                    <button
                      onClick={() => applyFormat(item.id, 'strikeThrough')}
                      className="p-0.5 sm:p-1 md:p-1.5 hover:bg-gray-200 rounded transition-colors flex-shrink-0"
                      title="Strikethrough"
                      type="button"
                    >
                      <Strikethrough size={14} className="sm:w-[15px] sm:h-[15px] md:w-4 md:h-4 lg:w-[18px] lg:h-[18px] text-gray-700" />
                    </button>
                    <div className="w-px h-3 sm:h-4 md:h-5 lg:h-6 bg-gray-300 mx-0.5 sm:mx-1 flex-shrink-0"></div>
                    <button
                      onClick={() => applyFormat(item.id, 'insertHorizontalRule')}
                      className="p-0.5 sm:p-1 md:p-1.5 hover:bg-gray-200 rounded transition-colors flex-shrink-0"
                      title="Horizontal Line"
                      type="button"
                    >
                      <Minus size={14} className="sm:w-[15px] sm:h-[15px] md:w-4 md:h-4 lg:w-[18px] lg:h-[18px] text-gray-700" />
                    </button>
                    <button
                      onClick={() => applyFormat(item.id, 'formatBlock', '<h2>')}
                      className="px-1 sm:px-1.5 md:px-2 py-0.5 sm:py-1 hover:bg-gray-200 rounded transition-colors text-[10px] sm:text-xs md:text-sm font-semibold text-gray-700 flex-shrink-0"
                      title="Heading"
                      type="button"
                    >
                      H
                    </button>
                    <button
                      onClick={() => insertLink(item.id)}
                      className="p-0.5 sm:p-1 md:p-1.5 hover:bg-gray-200 rounded transition-colors flex-shrink-0"
                      title="Insert Link"
                      type="button"
                    >
                      <LinkIcon size={14} className="sm:w-[15px] sm:h-[15px] md:w-4 md:h-4 lg:w-[18px] lg:h-[18px] text-gray-700" />
                    </button>
                    <div className="w-px h-3 sm:h-4 md:h-5 lg:h-6 bg-gray-300 mx-0.5 sm:mx-1 flex-shrink-0"></div>
                    <button
                      onClick={() => applyFormat(item.id, 'insertOrderedList')}
                      className="p-0.5 sm:p-1 md:p-1.5 hover:bg-gray-200 rounded transition-colors flex-shrink-0"
                      title="Numbered List"
                      type="button"
                    >
                      <ListOrdered size={14} className="sm:w-[15px] sm:h-[15px] md:w-4 md:h-4 lg:w-[18px] lg:h-[18px] text-gray-700" />
                    </button>
                    <button
                      onClick={() => applyFormat(item.id, 'insertUnorderedList')}
                      className="p-0.5 sm:p-1 md:p-1.5 hover:bg-gray-200 rounded transition-colors flex-shrink-0"
                      title="Bullet List"
                      type="button"
                    >
                      <List size={14} className="sm:w-[15px] sm:h-[15px] md:w-4 md:h-4 lg:w-[18px] lg:h-[18px] text-gray-700" />
                    </button>
                    <button
                      onClick={() => toggleDescription(item.id)}
                      className="ml-auto p-0.5 sm:p-1 md:p-1.5 hover:bg-gray-200 rounded transition-colors flex-shrink-0"
                      title="Close"
                      type="button"
                    >
                      <X size={14} className="sm:w-[15px] sm:h-[15px] md:w-4 md:h-4 lg:w-[18px] lg:h-[18px] text-gray-700" />
                    </button>
                  </div>
                  <div
                    ref={(el) => { editorRefs.current[item.id] = el; }}
                    contentEditable
                    onInput={(e) => handleEditorInput(item.id, e)}
                    onKeyDown={(e) => handleEditorKeyDown(item.id, e)}
                    onPaste={handleEditorPaste}
                    dangerouslySetInnerHTML={{ __html: item.description || '' }}
                    className="w-full px-1.5 sm:px-2 md:px-3 py-1.5 sm:py-2 md:py-3 text-[11px] sm:text-xs md:text-sm outline-none focus:ring-2 focus:ring-purple-200 min-h-[80px] sm:min-h-[100px] md:min-h-[120px] max-h-[200px] sm:max-h-[250px] md:max-h-[300px] overflow-y-auto"
                    style={{ wordBreak: 'break-word', direction: 'ltr', textAlign: 'left' }}
                    suppressContentEditableWarning
                  />
                </div>
              </div>
            )}

            {item.showImage && (
              <div className="mb-1.5 sm:mb-2 md:mb-3">
                {item.image ? (
                  <div className="relative inline-block">
                    <img src={item.image} alt="Item" className="h-20 sm:h-24 md:h-28 lg:h-32 rounded-lg border border-gray-300" />
                    <button
                      onClick={() => updateItem(item.id, 'image', null)}
                      className="absolute -top-1 -right-1 sm:-top-2 sm:-right-2 bg-red-500 text-white rounded-full p-0.5 sm:p-1 hover:bg-red-600"
                    >
                      <X size={10} className="sm:w-3 sm:h-3 md:w-[14px] md:h-[14px]" />
                    </button>
                  </div>
                ) : (
                  <div>
                    <input
                      type="file"
                      id={`image-${item.id}`}
                      accept="image/*"
                      onChange={(e) => handleImageUpload(item.id, e)}
                      className="hidden"
                    />
                    <label
                      htmlFor={`image-${item.id}`}
                      className="inline-flex items-center gap-1.5 sm:gap-2 px-2 sm:px-3 md:px-4 py-1.5 sm:py-2 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-purple-400 transition-colors"
                    >
                      <Image size={16} className="sm:w-[18px] sm:h-[18px] md:w-5 md:h-5 text-gray-400" />
                      <span className="text-[10px] sm:text-xs md:text-sm text-gray-600">Click to upload image</span>
                    </label>
                  </div>
                )}
              </div>
            )}

            <div className="flex flex-wrap items-center gap-2 sm:gap-3 md:gap-4 mb-1.5 sm:mb-2 md:mb-3">
              <button
                onClick={() => toggleDescription(item.id)}
                className="flex items-center gap-1 sm:gap-1.5 md:gap-2 text-purple-600 hover:text-purple-700 text-[10px] sm:text-xs md:text-sm"
              >
                <Plus size={12} className="sm:w-[14px] sm:h-[14px] md:w-4 md:h-4" />
                <span>{item.showDescription ? 'Hide Description' : 'Add Description'}</span>
              </button>
              <button
                onClick={() => toggleImage(item.id)}
                className="flex items-center gap-1 sm:gap-1.5 md:gap-2 text-purple-600 hover:text-purple-700 text-[10px] sm:text-xs md:text-sm"
              >
                <Image size={12} className="sm:w-[14px] sm:h-[14px] md:w-4 md:h-4" />
                <span>{item.showImage ? 'Hide Image' : 'Add Image'}</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const ungroupedItems = items.filter(item => !item.groupId);

  return (
    <div className="px-1 sm:px-2 md:px-4 lg:px-6 xl:px-8 pt-0 pb-2 sm:pb-3 md:pb-4 lg:pb-6">
      <div className="max-w-7xl mx-auto">
        <div className="bg-white rounded-lg shadow-sm overflow-hidden border border-gray-200">
          {/* Desktop Header */}
          <div className="hidden md:flex bg-gradient-to-r from-purple-600 to-purple-700 text-white px-3 sm:px-4 md:px-6 py-2 sm:py-3 md:py-4 text-xs sm:text-sm font-semibold">
            {visibleColumns.map((column, idx) => (
              <div
                key={column.id}
                className={`flex-1 ${idx === 0 ? 'flex-[2]' : ''} px-1 sm:px-2`}
                style={{ minWidth: '70px' }}
              >
                {column.name}
              </div>
            ))}
            <div className="w-12 sm:w-16 md:w-20 lg:w-24"></div>
          </div>

          {/* Mobile Header */}
          <div className="md:hidden bg-gradient-to-r from-purple-600 to-purple-700 text-white px-2 py-2 text-[10px] sm:text-xs font-semibold">
            <div className="text-center">Invoice Items</div>
          </div>

          <div className="divide-y divide-gray-200">
            {ungroupedItems.map((item, index) => renderItem(item, index))}
          </div>

          {groups.map((group) => (
            <div key={group.id} className="border-t-2 border-gray-300">
              <div className="bg-purple-50 px-6 py-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <button onClick={() => toggleGroup(group.id)} className="text-purple-600 hover:text-purple-700">
                    {group.isCollapsed ? <ChevronDown size={20} /> : <ChevronUp size={20} />}
                  </button>
                  <h3 className="font-semibold text-gray-900">{group.name}</h3>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => addNewItem(group.id)}
                    className="text-purple-600 hover:text-purple-700 text-sm font-medium transition-colors"
                  >
                    + Add Item
                  </button>
                  <button
                    onClick={() => deleteGroup(group.id)}
                    className="text-red-500 hover:text-red-600 transition-colors"
                  >
                    <X size={18} />
                  </button>
                </div>
              </div>

              {!group.isCollapsed && (
                <div className="divide-y divide-gray-200">
                  {items.filter(item => item.groupId === group.id).map((item, index) => renderItem(item, index))}
                </div>
              )}
            </div>
          ))}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3 md:gap-4 p-2 sm:p-3 border-t-2 border-dashed border-gray-300 bg-gray-50">
            <button
              onClick={() => addNewItem()}
              className="flex items-center justify-center gap-1.5 sm:gap-2 py-1.5 sm:py-2 md:py-2.5 border-2 border-dashed border-purple-300 rounded-lg text-purple-600 hover:border-purple-500 hover:bg-purple-50 transition-all duration-200 font-medium text-[10px] sm:text-xs md:text-sm"
            >
              <Plus size={16} className="sm:w-[18px] sm:h-[18px] md:w-5 md:h-5" />
              <span>Add New Line</span>
            </button>

            <button
              onClick={() => setShowGroupModal(true)}
              className="flex items-center justify-center gap-1.5 sm:gap-2 py-1.5 sm:py-2 md:py-2.5 border-2 border-dashed border-purple-300 rounded-lg text-purple-600 hover:border-purple-500 hover:bg-purple-50 transition-all duration-200 font-medium text-[10px] sm:text-xs md:text-sm"
            >
              <Plus size={16} className="sm:w-[18px] sm:h-[18px] md:w-5 md:h-5" />
              <span>Add New Group</span>
            </button>
          </div>
        </div>
      </div>

      {showGroupModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between p-4 sm:p-6 border-b border-gray-200">
              <h2 className="text-lg sm:text-xl font-semibold text-gray-900">Add New Group</h2>
              <button
                onClick={() => {
                  setShowGroupModal(false);
                  setGroupName('');
                }}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X size={20} className="sm:w-6 sm:h-6" />
              </button>
            </div>

            <div className="p-4 sm:p-6">
              <div className="mb-4 sm:mb-6">
                <label className="block text-gray-900 font-medium mb-2 text-sm sm:text-base">Group Name</label>
                <input
                  type="text"
                  placeholder="Enter group name"
                  value={groupName}
                  onChange={(e) => setGroupName(e.target.value)}
                  className="w-full px-3 sm:px-4 py-2 sm:py-3 text-sm sm:text-base border border-gray-300 rounded-lg outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-200 transition-all"
                  autoFocus
                />
              </div>

              <div className="flex flex-col sm:flex-row justify-end gap-2 sm:gap-3">
                <button
                  onClick={() => {
                    setShowGroupModal(false);
                    setGroupName('');
                  }}
                  className="w-full sm:w-auto px-4 sm:px-6 py-2 sm:py-2.5 text-sm sm:text-base text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors font-medium"
                >
                  Cancel
                </button>
                <button
                  onClick={addNewGroup}
                  className="w-full sm:w-auto px-4 sm:px-6 py-2 sm:py-2.5 text-sm sm:text-base bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-all duration-200 font-medium shadow-sm hover:shadow-md"
                >
                  Create Group
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}