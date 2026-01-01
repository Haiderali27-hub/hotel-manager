import React, { useEffect, useState } from 'react';
import type { MenuItem, Unit } from '../api/client';
import {
    addMenuItem,
    addUnit,
    cleanupSoftDeletedUnits,
    deleteMenuItem,
    deleteUnit,
    getMenuItems,
    getTaxEnabled,
    getTaxRate,
    getUnits,
    setTaxEnabled as saveTaxEnabled,
    setTaxRate as saveTaxRate,
    updateMenuItem
} from '../api/client';
import { useCurrency } from '../context/CurrencyContext';
import { useLabels } from '../context/LabelContext';
import { useNotification } from '../context/NotificationContext';
import { useTheme } from '../context/ThemeContext';

interface ManageCatalogResourcesProps {
    onBack: () => void;
}

const ManageCatalogResources: React.FC<ManageCatalogResourcesProps> = ({ onBack }) => {
    const { colors } = useTheme();
    const { showSuccess, showError } = useNotification();
    const { formatMoney } = useCurrency();
    const { current: label } = useLabels();
    const [activeTab, setActiveTab] = useState<'menu' | 'rooms' | 'settings'>('menu');
    const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
    const [rooms, setRooms] = useState<Unit[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Menu form states
    const [showMenuForm, setShowMenuForm] = useState(false);
    const [editingMenuItem, setEditingMenuItem] = useState<MenuItem | null>(null);
    const [menuName, setMenuName] = useState('');
    const [menuPrice, setMenuPrice] = useState('');

    // Room form states
    const [showRoomForm, setShowRoomForm] = useState(false);
    const [roomNumber, setRoomNumber] = useState('');
    const [roomType, setRoomType] = useState('Standard');
    const [roomPrice, setRoomPrice] = useState('');

    // Settings states
    const [taxRate, setTaxRate] = useState('5.0');
    const [taxEnabled, setTaxEnabled] = useState(true);
    const [savingSettings, setSavingSettings] = useState(false);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setLoading(true);
        try {
            const [menuData, roomData] = await Promise.all([
                getMenuItems(),
                getUnits()
            ]);
            setMenuItems(menuData);
            setRooms(roomData);
            
            // Load settings
            await loadSettings();
            
            setError(null);
        } catch (err) {
            const errorMessage = 'Failed to load data';
            setError(errorMessage);
            showError('Loading Error', errorMessage);
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const loadSettings = async () => {
        try {
            // Try to get tax rate from backend
            const response = await getTaxRate();
            setTaxRate(response.toString());
            
            // Try to get tax enabled setting
            try {
                const taxEnabledResponse = await getTaxEnabled();
                setTaxEnabled(taxEnabledResponse);
            } catch (err) {
                setTaxEnabled(true); // Default to enabled
            }
        } catch (err) {
            // If no tax rate is set, use default 5%
            console.log('Using default tax rate of 5%');
            setTaxRate('5.0');
            setTaxEnabled(true);
        }
    };

    const handleSaveSettings = async () => {
        const rate = parseFloat(taxRate);
        if (isNaN(rate) || rate < 0 || rate > 100) {
            showError('Invalid Tax Rate', 'Please enter a valid tax rate between 0 and 100');
            return;
        }

        setSavingSettings(true);
        try {
            console.log('Saving tax settings:', { rate, enabled: taxEnabled });
            await saveTaxRate(rate);
            await saveTaxEnabled(taxEnabled);
            showSuccess('Settings Saved', 'Tax settings updated successfully');
            // Reload settings to confirm they were saved
            await loadSettings();
        } catch (err) {
            console.error('Detailed error:', err);
            const errorMessage = err instanceof Error ? err.message : String(err);
            showError('Save Error', `Failed to save tax settings: ${errorMessage}`);
        } finally {
            setSavingSettings(false);
        }
    };

    const handleAddMenuItem = async () => {
        if (!menuName.trim() || !menuPrice.trim()) {
            const errorMessage = 'Please fill in all fields';
            setError(errorMessage);
            showError('Validation Error', 'Menu name and price are required');
            return;
        }

        const price = parseFloat(menuPrice);
        if (isNaN(price) || price <= 0) {
            const errorMessage = 'Please enter a valid price';
            setError(errorMessage);
            showError('Validation Error', 'Price must be a positive number');
            return;
        }

        try {
            await addMenuItem({
                name: menuName.trim(),
                price: price,
                category: 'Main Course',
                is_available: true
            });
            
            showSuccess('Menu Item Added', `${menuName} has been added to the menu`);
            setMenuName('');
            setMenuPrice('');
            setShowMenuForm(false);
            setError(null);
            loadData();
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Failed to add menu item';
            setError(errorMessage);
            
            // Check for specific error types
            if (errorMessage.toLowerCase().includes('already exists') || errorMessage.toLowerCase().includes('duplicate')) {
                showError('Duplicate Item', 'A menu item with this name already exists');
            } else {
                showError('Failed to Add Item', errorMessage);
            }
        }
    };

    const handleUpdateMenuItem = async () => {
        if (!editingMenuItem || !menuName.trim() || !menuPrice.trim()) {
            const errorMessage = 'Please fill in all fields';
            setError(errorMessage);
            showError('Validation Error', 'Menu name and price are required');
            return;
        }

        const price = parseFloat(menuPrice);
        if (isNaN(price) || price <= 0) {
            const errorMessage = 'Please enter a valid price';
            setError(errorMessage);
            showError('Validation Error', 'Price must be a positive number');
            return;
        }

        try {
            await updateMenuItem(editingMenuItem.id, {
                name: menuName.trim(),
                price: price,
                is_available: true
            });
            
            showSuccess('Menu Item Updated', `"${menuName}" has been updated successfully`);
            setMenuName('');
            setMenuPrice('');
            setEditingMenuItem(null);
            setShowMenuForm(false);
            setError(null);
            loadData();
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Failed to update menu item';
            setError(errorMessage);
            showError('Failed to Update Item', errorMessage);
        }
    };

    const handleDeleteMenuItem = async (id: number) => {
        const menuItem = menuItems.find(item => item.id === id);
        const itemInfo = menuItem ? `"${menuItem.name}"` : 'this menu item';
        
        if (confirm(`Are you sure you want to delete ${itemInfo}?`)) {
            try {
                await deleteMenuItem(id);
                showSuccess('Menu Item Deleted', `${itemInfo} has been removed from the menu`);
                setError(null);
                loadData();
            } catch (err) {
                const errorMessage = err instanceof Error ? err.message : 'Failed to delete menu item';
                setError(errorMessage);
                showError('Failed to Delete Item', errorMessage);
            }
        }
    };

    const handleEditMenuItem = (item: MenuItem) => {
        setEditingMenuItem(item);
        setMenuName(item.name);
        setMenuPrice(item.price.toString());
        setShowMenuForm(true);
    };

    const handleAddRoom = async () => {
        if (!roomNumber.trim() || !roomPrice.trim()) {
            const errorMessage = 'Please fill in all required fields';
            setError(errorMessage);
            showError('Validation Error', `${label.unit} number and price are required`);
            return;
        }

        const finalRoomType = roomType.trim();
        if (!finalRoomType) {
            const errorMessage = 'Please specify a type';
            setError(errorMessage);
            showError('Validation Error', `${label.unit} type is required`);
            return;
        }

        const price = parseFloat(roomPrice);
        if (isNaN(price) || price <= 0) {
            const errorMessage = 'Please enter a valid price';
            setError(errorMessage);
            showError('Validation Error', 'Price must be a positive number');
            return;
        }

        try {
            await addUnit({
                number: roomNumber.trim(),
                room_type: finalRoomType,
                daily_rate: price
            });
            
            showSuccess(`${label.unit} Added`, `${label.unit} ${roomNumber} has been added successfully`);
            setRoomNumber('');
            setRoomType('Standard');
            setRoomPrice('');
            setShowRoomForm(false);
            setError(null);
            loadData();
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : `Failed to add ${label.unit.toLowerCase()}`;
            setError(errorMessage);
            
            // Check for specific error types
            if (errorMessage.toLowerCase().includes('already exists') || errorMessage.toLowerCase().includes('duplicate')) {
                showError(`Duplicate ${label.unit}`, `A ${label.unit.toLowerCase()} with this number already exists`);
            } else {
                showError(`Failed to Add ${label.unit}`, errorMessage);
            }
        }
    };

    const handleCleanupSoftDeletedRooms = async () => {
        if (confirm(`Are you sure you want to cleanup all soft-deleted ${label.unit.toLowerCase()}s? This will permanently remove them from the database.`)) {
            try {
                setLoading(true);
                const result = await cleanupSoftDeletedUnits();
                showSuccess('Cleanup Complete', result);
                setError(null);
                loadData(); // Reload rooms to reflect changes
            } catch (err) {
                const errorMessage = err instanceof Error ? err.message : `Failed to cleanup soft-deleted ${label.unit.toLowerCase()}s`;
                setError(errorMessage);
                showError('Cleanup Failed', errorMessage);
            } finally {
                setLoading(false);
            }
        }
    };

    const handleDeleteRoom = async (id: number) => {
        const room = rooms.find(r => r.id === id);
        const roomInfo = room ? `${label.unit} ${room.number}` : `This ${label.unit.toLowerCase()}`;
        
        if (confirm(`Are you sure you want to delete ${roomInfo}?`)) {
            try {
                await deleteUnit(id);
                showSuccess(`${label.unit} Deleted`, `${roomInfo} has been deleted successfully`);
                setError(null);
                loadData();
            } catch (err) {
                const errorMessage = err instanceof Error ? err.message : `Failed to delete ${label.unit.toLowerCase()}`;
                setError(errorMessage);
                
                if (errorMessage.toLowerCase().includes('occupied') || errorMessage.toLowerCase().includes('guest') || errorMessage.toLowerCase().includes('customer')) {
                    showError(`Cannot Delete ${label.unit}`, `${label.unit} cannot be deleted because it is currently occupied`);
                } else {
                    showError(`Failed to Delete ${label.unit}`, errorMessage);
                }
            }
        }
    };

    const resetMenuForm = () => {
        setMenuName('');
        setMenuPrice('');
        setEditingMenuItem(null);
        setShowMenuForm(false);
    };

    const resetRoomForm = () => {
        setRoomNumber('');
        setRoomType('Standard');
        setRoomPrice('');
        setShowRoomForm(false);
    };

    return (
        <div style={{
            padding: '2rem',
            backgroundColor: colors.primary,
            minHeight: '100vh',
            color: colors.text
        }}>
            {/* Header */}
            <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '1rem',
                marginBottom: '2rem'
            }}>
                <button
                    onClick={onBack}
                    style={{
                        backgroundColor: colors.accent,
                        color: 'white',
                        border: 'none',
                        padding: '0.5rem 1rem',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        fontSize: '1rem'
                    }}
                >
                    ← Back
                </button>
                <h1 style={{ margin: 0, fontSize: '2rem', fontWeight: 'bold' }}>
                    Manage Catalog
                </h1>
            </div>

            {/* Error Message */}
            {error && (
                <div style={{
                    backgroundColor: colors.errorBg,
                    color: colors.error,
                    padding: '1rem',
                    borderRadius: '8px',
                    marginBottom: '1rem'
                }}>
                    {error}
                </div>
            )}

            {/* Tab Navigation */}
            <div style={{
                display: 'flex',
                gap: '0.5rem',
                marginBottom: '2rem',
                borderBottom: `2px solid ${colors.border}`
            }}>
                <button
                    onClick={() => setActiveTab('menu')}
                    style={{
                        padding: '1rem 2rem',
                        backgroundColor: activeTab === 'menu' ? colors.accent : 'transparent',
                        color: activeTab === 'menu' ? 'white' : colors.text,
                        border: 'none',
                        borderRadius: '8px 8px 0 0',
                        cursor: 'pointer',
                        fontSize: '1rem',
                        fontWeight: '600'
                    }}
                >
                    Menu Items
                </button>
                <button
                    onClick={() => setActiveTab('rooms')}
                    style={{
                        padding: '1rem 2rem',
                        backgroundColor: activeTab === 'rooms' ? colors.accent : 'transparent',
                        color: activeTab === 'rooms' ? 'white' : colors.text,
                        border: 'none',
                        borderRadius: '8px 8px 0 0',
                        cursor: 'pointer',
                        fontSize: '1rem',
                        fontWeight: '600'
                    }}
                >
                    {label.unit}s
                </button>
                <button
                    onClick={() => setActiveTab('settings')}
                    style={{
                        padding: '1rem 2rem',
                        backgroundColor: activeTab === 'settings' ? colors.accent : 'transparent',
                        color: activeTab === 'settings' ? 'white' : colors.text,
                        border: 'none',
                        borderRadius: '8px 8px 0 0',
                        cursor: 'pointer',
                        fontSize: '1rem',
                        fontWeight: '600'
                    }}
                >
                    Settings
                </button>
            </div>

            {/* Menu Tab */}
            {activeTab === 'menu' && (
                <div>
                    {/* Add Menu Item Button */}
                    <div style={{ marginBottom: '2rem' }}>
                        <button
                            onClick={() => setShowMenuForm(true)}
                            style={{
                                backgroundColor: colors.success,
                                color: 'white',
                                border: 'none',
                                padding: '0.75rem 1.5rem',
                                borderRadius: '8px',
                                cursor: 'pointer',
                                fontSize: '1rem',
                                fontWeight: '600'
                            }}
                        >
                            + Add Menu Item
                        </button>
                    </div>

                    {/* Menu Items Table */}
                    <div style={{
                        backgroundColor: colors.surface,
                        borderRadius: '12px',
                        overflow: 'hidden',
                        border: `1px solid ${colors.border}`
                    }}>
                        {/* Table Header */}
                        <div style={{
                            display: 'grid',
                            gridTemplateColumns: '50px 1fr 150px 200px',
                            backgroundColor: colors.secondary,
                            padding: '1rem',
                            fontWeight: '600',
                            borderBottom: `1px solid ${colors.border}`
                        }}>
                            <div>S.NO</div>
                            <div>Item Name</div>
                            <div>Price</div>
                            <div>Action</div>
                        </div>

                        {/* Table Body */}
                        {loading ? (
                            <div style={{ padding: '2rem', textAlign: 'center' }}>
                                Loading...
                            </div>
                        ) : menuItems.length === 0 ? (
                            <div style={{ padding: '2rem', textAlign: 'center', color: colors.textMuted }}>
                                No menu items found
                            </div>
                        ) : (
                            menuItems.map((item, index) => (
                                <div
                                    key={item.id}
                                    style={{
                                        display: 'grid',
                                        gridTemplateColumns: '50px 1fr 150px 200px',
                                        padding: '1rem',
                                        borderBottom: index < menuItems.length - 1 ? `1px solid ${colors.border}` : 'none',
                                        alignItems: 'center'
                                    }}
                                >
                                    <div>{index + 1}</div>
                                    <div>{item.name}</div>
                                    <div>{formatMoney(item.price)}</div>
                                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                                        <button
                                            onClick={() => handleEditMenuItem(item)}
                                            style={{
                                                backgroundColor: colors.warning,
                                                color: 'white',
                                                border: 'none',
                                                padding: '0.5rem 1rem',
                                                borderRadius: '6px',
                                                cursor: 'pointer',
                                                fontSize: '0.875rem'
                                            }}
                                        >
                                            Edit
                                        </button>
                                        <button
                                            onClick={() => handleDeleteMenuItem(item.id)}
                                            style={{
                                                backgroundColor: colors.error,
                                                color: 'white',
                                                border: 'none',
                                                padding: '0.5rem 1rem',
                                                borderRadius: '6px',
                                                cursor: 'pointer',
                                                fontSize: '0.875rem'
                                            }}
                                        >
                                            Delete
                                        </button>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            )}

            {/* Resources Tab */}
            {activeTab === 'rooms' && (
                <div>
                    {/* Add Room Button */}
                    <div style={{ marginBottom: '2rem', display: 'flex', gap: '1rem' }}>
                        <button
                            onClick={() => setShowRoomForm(true)}
                            style={{
                                backgroundColor: colors.success,
                                color: 'white',
                                border: 'none',
                                padding: '0.75rem 1.5rem',
                                borderRadius: '8px',
                                cursor: 'pointer',
                                fontSize: '1rem',
                                fontWeight: '600'
                            }}
                        >
                            + Add {label.unit}
                        </button>
                        <button
                            onClick={handleCleanupSoftDeletedRooms}
                            style={{
                                backgroundColor: colors.warning,
                                color: 'white',
                                border: 'none',
                                padding: '0.75rem 1.5rem',
                                borderRadius: '8px',
                                cursor: 'pointer',
                                fontSize: '1rem',
                                fontWeight: '600'
                            }}
                        >
                            🧹 Cleanup Deleted {label.unit}s
                        </button>
                    </div>

                    {/* Rooms Table */}
                    <div style={{
                        backgroundColor: colors.surface,
                        borderRadius: '12px',
                        overflow: 'hidden',
                        border: `1px solid ${colors.border}`
                    }}>
                        {/* Table Header */}
                        <div style={{
                            display: 'grid',
                            gridTemplateColumns: '50px 150px 120px 120px 150px 120px',
                            backgroundColor: colors.secondary,
                            padding: '1rem',
                            fontWeight: '600',
                            borderBottom: `1px solid ${colors.border}`
                        }}>
                            <div>S.NO</div>
                            <div>{label.unit} Number</div>
                            <div>Type</div>
                            <div>Rate</div>
                            <div>Status</div>
                            <div>Action</div>
                        </div>

                        {/* Table Body */}
                        {loading ? (
                            <div style={{ padding: '2rem', textAlign: 'center' }}>
                                Loading...
                            </div>
                        ) : rooms.length === 0 ? (
                            <div style={{ padding: '2rem', textAlign: 'center', color: colors.textMuted }}>
                                No {label.unit.toLowerCase()}s found
                            </div>
                        ) : (
                            rooms.map((room, index) => (
                                <div
                                    key={room.id}
                                    style={{
                                        display: 'grid',
                                        gridTemplateColumns: '50px 150px 120px 120px 150px 120px',
                                        padding: '1rem',
                                        borderBottom: index < rooms.length - 1 ? `1px solid ${colors.border}` : 'none',
                                        alignItems: 'center'
                                    }}
                                >
                                    <div>{index + 1}</div>
                                    <div>{label.unit} {room.number}</div>
                                    <div>{room.room_type}</div>
                                    <div>{formatMoney(room.daily_rate)}</div>
                                    <div>
                                        {room.is_occupied ? (
                                            <span style={{
                                                color: colors.error,
                                                fontWeight: 'bold',
                                                backgroundColor: 'var(--bm-accent-20)',
                                                padding: '0.25rem 0.5rem',
                                                borderRadius: '4px',
                                                fontSize: '0.75rem'
                                            }}>
                                                IN USE
                                                {room.guest_name && (
                                                    <div style={{ fontSize: '0.7rem', fontWeight: 'normal', marginTop: '2px' }}>
                                                        Assigned to {room.guest_name}
                                                    </div>
                                                )}
                                            </span>
                                        ) : (
                                            <span style={{
                                                color: colors.success,
                                                fontWeight: 'bold',
                                                backgroundColor: 'var(--bm-primary-20)',
                                                padding: '0.25rem 0.5rem',
                                                borderRadius: '4px',
                                                fontSize: '0.75rem'
                                            }}>
                                                AVAILABLE
                                            </span>
                                        )}
                                    </div>
                                    <div>
                                        <button
                                            onClick={() => handleDeleteRoom(room.id)}
                                            disabled={room.is_occupied}
                                            style={{
                                                backgroundColor: room.is_occupied ? colors.textMuted : colors.error,
                                                color: 'white',
                                                border: 'none',
                                                padding: '0.5rem 1rem',
                                                borderRadius: '6px',
                                                cursor: room.is_occupied ? 'not-allowed' : 'pointer',
                                                fontSize: '0.875rem',
                                                opacity: room.is_occupied ? 0.5 : 1
                                            }}
                                            title={room.is_occupied ? `Cannot delete assigned ${label.unit.toLowerCase()}` : `Delete ${label.unit.toLowerCase()}`}
                                        >
                                            Delete
                                        </button>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            )}

            {/* Menu Form Modal */}
            {showMenuForm && (
                <div style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    backgroundColor: colors.overlay,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 1000
                }}>
                    <div style={{
                        backgroundColor: colors.surface,
                        padding: '2rem',
                        borderRadius: '12px',
                        border: `1px solid ${colors.border}`,
                        maxWidth: '400px',
                        width: '90%'
                    }}>
                        <h3 style={{ margin: '0 0 1rem 0', color: colors.text }}>
                            {editingMenuItem ? 'Edit Menu Item' : 'Add Menu Item'}
                        </h3>

                        <div style={{ marginBottom: '1rem' }}>
                            <label style={{ display: 'block', marginBottom: '0.5rem', color: colors.text }}>
                                Item Name
                            </label>
                            <input
                                type="text"
                                value={menuName}
                                onChange={(e) => setMenuName(e.target.value)}
                                style={{
                                    width: '100%',
                                    padding: '0.75rem',
                                    backgroundColor: colors.surface,
                                    border: `1px solid ${colors.border}`,
                                    borderRadius: '8px',
                                    color: colors.text,
                                    fontSize: '1rem'
                                }}
                                placeholder="Enter item name"
                            />
                        </div>

                        <div style={{ marginBottom: '1.5rem' }}>
                            <label style={{ display: 'block', marginBottom: '0.5rem', color: colors.text }}>
                                Price
                            </label>
                            <input
                                type="number"
                                value={menuPrice}
                                onChange={(e) => setMenuPrice(e.target.value)}
                                style={{
                                    width: '100%',
                                    padding: '0.75rem',
                                    backgroundColor: colors.surface,
                                    border: `1px solid ${colors.border}`,
                                    borderRadius: '8px',
                                    color: colors.text,
                                    fontSize: '1rem'
                                }}
                                placeholder="Enter price"
                            />
                        </div>

                        <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
                            <button
                                onClick={resetMenuForm}
                                style={{
                                    backgroundColor: colors.textMuted,
                                    color: 'white',
                                    border: 'none',
                                    padding: '0.75rem 1.5rem',
                                    borderRadius: '8px',
                                    cursor: 'pointer',
                                    fontSize: '1rem'
                                }}
                            >
                                Cancel
                            </button>
                            <button
                                onClick={editingMenuItem ? handleUpdateMenuItem : handleAddMenuItem}
                                style={{
                                    backgroundColor: colors.success,
                                    color: 'white',
                                    border: 'none',
                                    padding: '0.75rem 1.5rem',
                                    borderRadius: '8px',
                                    cursor: 'pointer',
                                    fontSize: '1rem'
                                }}
                            >
                                {editingMenuItem ? 'Update' : 'Add'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Room Form Modal */}
            {showRoomForm && (
                <div style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    backgroundColor: colors.overlay,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 1000
                }}>
                    <div style={{
                        backgroundColor: colors.surface,
                        padding: '2rem',
                        borderRadius: '12px',
                        border: `1px solid ${colors.border}`,
                        maxWidth: '400px',
                        width: '90%'
                    }}>
                        <h3 style={{ margin: '0 0 1rem 0', color: colors.text }}>
                            Add {label.unit}
                        </h3>

                        <div style={{ marginBottom: '1.5rem' }}>
                            <label style={{ display: 'block', marginBottom: '0.5rem', color: colors.text }}>
                                {label.unit} Number
                            </label>
                            <input
                                type="text"
                                value={roomNumber}
                                onChange={(e) => setRoomNumber(e.target.value)}
                                style={{
                                    width: '100%',
                                    padding: '0.75rem',
                                    backgroundColor: colors.surface,
                                    border: `1px solid ${colors.border}`,
                                    borderRadius: '8px',
                                    color: colors.text,
                                    fontSize: '1rem'
                                }}
                                placeholder={`Enter ${label.unit.toLowerCase()} number`}
                            />
                        </div>

                        <div style={{ marginBottom: '1.5rem' }}>
                            <label style={{ display: 'block', marginBottom: '0.5rem', color: colors.text }}>
                                {label.unit} Type
                            </label>
                            <input
                                type="text"
                                value={roomType}
                                onChange={(e) => setRoomType(e.target.value)}
                                style={{
                                    width: '100%',
                                    padding: '0.75rem',
                                    backgroundColor: colors.surface,
                                    border: `1px solid ${colors.border}`,
                                    borderRadius: '8px',
                                    color: colors.text,
                                    fontSize: '1rem'
                                }}
                                placeholder="e.g., Standard"
                            />
                        </div>

                        <div style={{ marginBottom: '1.5rem' }}>
                            <label style={{ display: 'block', marginBottom: '0.5rem', color: colors.text }}>
                                Daily Rate
                            </label>
                            <input
                                type="number"
                                value={roomPrice}
                                onChange={(e) => setRoomPrice(e.target.value)}
                                style={{
                                    width: '100%',
                                    padding: '0.75rem',
                                    backgroundColor: colors.surface,
                                    border: `1px solid ${colors.border}`,
                                    borderRadius: '8px',
                                    color: colors.text,
                                    fontSize: '1rem'
                                }}
                                placeholder="Enter daily rate"
                                min="0"
                                step="0.01"
                            />
                        </div>

                        <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
                            <button
                                onClick={resetRoomForm}
                                style={{
                                    backgroundColor: colors.textMuted,
                                    color: 'white',
                                    border: 'none',
                                    padding: '0.75rem 1.5rem',
                                    borderRadius: '8px',
                                    cursor: 'pointer',
                                    fontSize: '1rem'
                                }}
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleAddRoom}
                                style={{
                                    backgroundColor: colors.success,
                                    color: 'white',
                                    border: 'none',
                                    padding: '0.75rem 1.5rem',
                                    borderRadius: '8px',
                                    cursor: 'pointer',
                                    fontSize: '1rem'
                                }}
                            >
                                Add
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Settings Tab */}
            {activeTab === 'settings' && (
                <div>
                    <div style={{
                        backgroundColor: colors.surface,
                        padding: '2rem',
                        borderRadius: '12px',
                        border: `1px solid ${colors.border}`,
                        maxWidth: '600px'
                    }}>
                        <h3 style={{ 
                            color: colors.text, 
                            marginBottom: '2rem',
                            fontSize: '1.5rem',
                            fontWeight: '600'
                        }}>
                            Tax Configuration
                        </h3>

                        <div style={{ marginBottom: '2rem' }}>
                            <label style={{ 
                                display: 'flex',
                                alignItems: 'center',
                                marginBottom: '1rem', 
                                color: colors.text,
                                fontWeight: '500',
                                cursor: 'pointer'
                            }}>
                                <input
                                    type="checkbox"
                                    checked={taxEnabled}
                                    onChange={(e) => setTaxEnabled(e.target.checked)}
                                    style={{
                                        marginRight: '0.5rem',
                                        width: '18px',
                                        height: '18px',
                                        cursor: 'pointer'
                                    }}
                                />
                                Apply Tax to Invoices
                            </label>
                            
                            {taxEnabled && (
                                <div>
                                    <label style={{ 
                                        display: 'block', 
                                        marginBottom: '0.5rem', 
                                        color: colors.text,
                                        fontWeight: '500'
                                    }}>
                                        Tax Rate (%)
                                    </label>
                                    <input
                                        type="number"
                                        step="0.1"
                                        min="0"
                                        max="100"
                                        value={taxRate}
                                        onChange={(e) => setTaxRate(e.target.value)}
                                        style={{
                                            width: '200px',
                                            padding: '0.75rem',
                                            backgroundColor: colors.surface,
                                            border: `1px solid ${colors.border}`,
                                            borderRadius: '8px',
                                            color: colors.text,
                                            fontSize: '1rem'
                                        }}
                                        placeholder="e.g. 5.0"
                                    />
                                    <div style={{
                                        marginTop: '0.5rem',
                                        fontSize: '0.875rem',
                                        color: colors.textSecondary
                                    }}>
                                        Enter the tax rate percentage (0-100). This will be applied to all invoices.
                                    </div>
                                </div>
                            )}
                        </div>

                        <div style={{ 
                            padding: '1rem',
                            backgroundColor: 'var(--bm-accent-20)',
                            borderRadius: '8px',
                            marginBottom: '2rem',
                            border: `1px solid ${colors.accent}40`
                        }}>
                            <h4 style={{ color: colors.text, marginBottom: '0.5rem' }}>Preview</h4>
                            <div style={{ color: colors.textSecondary, fontSize: '0.875rem' }}>
                                {taxEnabled ? (
                                    <>
                                        Tax enabled: <strong>{taxRate}%</strong><br/>
                                        Example: {formatMoney(1000, { maximumFractionDigits: 0 })} subtotal → {formatMoney((1000 * (1 + parseFloat(taxRate || '0') / 100)), { maximumFractionDigits: 0 })} total
                                    </>
                                ) : (
                                    <>
                                        Tax disabled<br/>
                                        Example: {formatMoney(1000, { maximumFractionDigits: 0 })} subtotal → {formatMoney(1000, { maximumFractionDigits: 0 })} total (no tax applied)
                                    </>
                                )}
                            </div>
                        </div>

                        <button
                            onClick={handleSaveSettings}
                            disabled={savingSettings}
                            style={{
                                backgroundColor: colors.success,
                                color: 'white',
                                border: 'none',
                                padding: '0.75rem 2rem',
                                borderRadius: '8px',
                                cursor: savingSettings ? 'not-allowed' : 'pointer',
                                fontSize: '1rem',
                                fontWeight: '500',
                                opacity: savingSettings ? 0.7 : 1
                            }}
                        >
                            {savingSettings ? 'Saving...' : 'Save Tax Rate'}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ManageCatalogResources;
