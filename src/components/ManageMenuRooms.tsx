import React, { useEffect, useState } from 'react';
import type { MenuItem, Room } from '../api/client';
import {
    addMenuItem,
    addRoom,
    deleteMenuItem,
    deleteRoom,
    getMenuItems,
    getRooms,
    updateMenuItem
} from '../api/client';
import { useTheme } from '../context/ThemeContext';

interface ManageMenuRoomsProps {
  onBack: () => void;
}

const ManageMenuRooms: React.FC<ManageMenuRoomsProps> = ({ onBack }) => {
  const { colors } = useTheme();
  const [activeTab, setActiveTab] = useState<'menu' | 'rooms'>('menu');
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
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
  const [roomType, setRoomType] = useState('Single Room');
  const [customRoomType, setCustomRoomType] = useState('');
  const [roomPrice, setRoomPrice] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [menuData, roomData] = await Promise.all([
        getMenuItems(),
        getRooms()
      ]);
      setMenuItems(menuData);
      setRooms(roomData);
      setError(null);
    } catch (err) {
      setError('Failed to load data');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleAddMenuItem = async () => {
    if (!menuName.trim() || !menuPrice.trim()) {
      setError('Please fill in all fields');
      return;
    }

    try {
      await addMenuItem({
        name: menuName.trim(),
        price: parseFloat(menuPrice),
        category: 'Main Course',
        is_available: true
      });
      setMenuName('');
      setMenuPrice('');
      setShowMenuForm(false);
      loadData();
    } catch (err) {
      setError('Failed to add menu item');
      console.error(err);
    }
  };

  const handleUpdateMenuItem = async () => {
    if (!editingMenuItem || !menuName.trim() || !menuPrice.trim()) {
      setError('Please fill in all fields');
      return;
    }

    try {
      await updateMenuItem(editingMenuItem.id, {
        name: menuName.trim(),
        price: parseFloat(menuPrice),
        is_available: true
      });
      setMenuName('');
      setMenuPrice('');
      setEditingMenuItem(null);
      setShowMenuForm(false);
      loadData();
    } catch (err) {
      setError('Failed to update menu item');
      console.error(err);
    }
  };

  const handleDeleteMenuItem = async (id: number) => {
    if (confirm('Are you sure you want to delete this menu item?')) {
      try {
        await deleteMenuItem(id);
        loadData();
      } catch (err) {
        setError('Failed to delete menu item');
        console.error(err);
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
      setError('Please fill in all required fields');
      return;
    }

    const finalRoomType = roomType === 'Other' ? customRoomType.trim() : roomType;
    if (!finalRoomType) {
      setError('Please specify room type');
      return;
    }

    try {
      await addRoom({
        number: roomNumber.trim(),
        room_type: finalRoomType,
        daily_rate: parseFloat(roomPrice)
      });
      setRoomNumber('');
      setRoomType('Single Room');
      setCustomRoomType('');
      setRoomPrice('');
      setShowRoomForm(false);
      loadData();
    } catch (err) {
      setError('Failed to add room');
      console.error(err);
    }
  };

  const handleDeleteRoom = async (id: number) => {
    if (confirm('Are you sure you want to delete this room?')) {
      try {
        await deleteRoom(id);
        loadData();
      } catch (err) {
        setError('Failed to delete room');
        console.error(err);
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
    setRoomType('Single Room');
    setCustomRoomType('');
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
            color: '#FFFFFF',
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
          Manage Menu & Rooms
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

      {/* Debug Test Buttons */}
      <div style={{ marginBottom: '1rem', display: 'flex', gap: '1rem' }}>
        <button
          onClick={async () => {
            try {
              console.log('🔍 Testing getRooms...');
              const rooms = await getRooms();
              console.log('✅ getRooms success:', rooms);
              alert(`Rooms: ${JSON.stringify(rooms, null, 2)}`);
            } catch (error) {
              console.error('❌ getRooms error:', error);
              alert(`Error: ${error}`);
            }
          }}
          style={{
            backgroundColor: '#007bff',
            color: 'white',
            padding: '0.5rem 1rem',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          Test getRooms
        </button>
        <button
          onClick={async () => {
            try {
              console.log('🔍 Testing getMenuItems...');
              const items = await getMenuItems();
              console.log('✅ getMenuItems success:', items);
              alert(`Menu Items: ${JSON.stringify(items, null, 2)}`);
            } catch (error) {
              console.error('❌ getMenuItems error:', error);
              alert(`Error: ${error}`);
            }
          }}
          style={{
            backgroundColor: '#28a745',
            color: 'white',
            padding: '0.5rem 1rem',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          Test getMenuItems
        </button>
        <button
          onClick={async () => {
            try {
              console.log('🔍 Testing addRoom...');
              const result = await addRoom({
                number: 'TEST-123',
                room_type: 'Test Room',
                daily_rate: 100.0
              });
              console.log('✅ addRoom success:', result);
              alert(`Add Room Success: ${result}`);
              loadData(); // Refresh data
            } catch (error) {
              console.error('❌ addRoom error:', error);
              alert(`Add Room Error: ${error}`);
            }
          }}
          style={{
            backgroundColor: '#17a2b8',
            color: 'white',
            padding: '0.5rem 1rem',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          Test addRoom
        </button>
        <button
          onClick={async () => {
            try {
              console.log('🔍 Testing deleteMenuItem...');
              // Try to delete the first menu item if any exist
              if (menuItems.length > 0) {
                const result = await deleteMenuItem(menuItems[0].id);
                console.log('✅ deleteMenuItem success:', result);
                alert(`Delete Menu Item Success: ${result}`);
                loadData(); // Refresh data
              } else {
                alert('No menu items to delete');
              }
            } catch (error) {
              console.error('❌ deleteMenuItem error:', error);
              alert(`Delete Menu Item Error: ${error}`);
            }
          }}
          style={{
            backgroundColor: '#dc3545',
            color: 'white',
            padding: '0.5rem 1rem',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          Test deleteMenuItem
        </button>
      </div>

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
            color: activeTab === 'menu' ? '#FFFFFF' : colors.text,
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
            color: activeTab === 'rooms' ? '#FFFFFF' : colors.text,
            border: 'none',
            borderRadius: '8px 8px 0 0',
            cursor: 'pointer',
            fontSize: '1rem',
            fontWeight: '600'
          }}
        >
          Rooms
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
                color: '#FFFFFF',
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
                  <div>RS {item.price}</div>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button
                      onClick={() => handleEditMenuItem(item)}
                      style={{
                        backgroundColor: colors.warning,
                        color: '#FFFFFF',
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
                        color: '#FFFFFF',
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

      {/* Rooms Tab */}
      {activeTab === 'rooms' && (
        <div>
          {/* Add Room Button */}
          <div style={{ marginBottom: '2rem' }}>
            <button
              onClick={() => setShowRoomForm(true)}
              style={{
                backgroundColor: colors.success,
                color: '#FFFFFF',
                border: 'none',
                padding: '0.75rem 1.5rem',
                borderRadius: '8px',
                cursor: 'pointer',
                fontSize: '1rem',
                fontWeight: '600'
              }}
            >
              + Add Room
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
              <div>Room Number</div>
              <div>Type</div>
              <div>Daily Rate</div>
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
                No rooms found
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
                  <div>Room {room.number}</div>
                  <div>{room.room_type}</div>
                  <div>${room.daily_rate}/night</div>
                  <div>
                    {room.is_occupied ? (
                      <span style={{
                        color: colors.error,
                        fontWeight: 'bold',
                        backgroundColor: colors.error + '20',
                        padding: '0.25rem 0.5rem',
                        borderRadius: '4px',
                        fontSize: '0.75rem'
                      }}>
                        ASSIGNED
                        {room.guest_name && (
                          <div style={{ fontSize: '0.7rem', fontWeight: 'normal', marginTop: '2px' }}>
                            to {room.guest_name}
                          </div>
                        )}
                      </span>
                    ) : (
                      <span style={{
                        color: '#28a745',
                        fontWeight: 'bold',
                        backgroundColor: '#28a745' + '20',
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
                        color: '#FFFFFF',
                        border: 'none',
                        padding: '0.5rem 1rem',
                        borderRadius: '6px',
                        cursor: room.is_occupied ? 'not-allowed' : 'pointer',
                        fontSize: '0.875rem',
                        opacity: room.is_occupied ? 0.5 : 1
                      }}
                      title={room.is_occupied ? 'Cannot delete assigned room' : 'Delete room'}
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
                Price (RS)
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
                  color: '#FFFFFF',
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
                  color: '#FFFFFF',
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
              Add Room
            </h3>
            
            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', color: colors.text }}>
                Room Number
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
                placeholder="Enter room number"
              />
            </div>

            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', color: colors.text }}>
                Room Type
              </label>
              <select
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
              >
                <option value="Single Room">Single Room</option>
                <option value="Delux Room">Delux Room</option>
                <option value="Family Room">Family Room</option>
                <option value="Master Room">Master Room</option>
                <option value="Other">Other</option>
              </select>
            </div>

            {roomType === 'Other' && (
              <div style={{ marginBottom: '1.5rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', color: colors.text }}>
                  Custom Room Type
                </label>
                <input
                  type="text"
                  value={customRoomType}
                  onChange={(e) => setCustomRoomType(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    backgroundColor: colors.surface,
                    border: `1px solid ${colors.border}`,
                    borderRadius: '8px',
                    color: colors.text,
                    fontSize: '1rem'
                  }}
                  placeholder="Enter custom room type"
                />
              </div>
            )}

            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', color: colors.text }}>
                Daily Rate ($)
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
                  color: '#FFFFFF',
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
                  color: '#FFFFFF',
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
    </div>
  );
};

export default ManageMenuRooms;
