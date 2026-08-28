'use client';

import { useState } from 'react';
import { CATEGORIES, COLOURS, BRANDS } from '@/types';
import { uploadPhoto } from '@/lib/supabase';
import { Camera, X } from 'lucide-react';
import toast from 'react-hot-toast';

interface ReportFormProps {
  type: 'lost' | 'found';
  onSubmit: (data: Record<string, unknown>) => Promise<void>;
}

export function ReportForm({ type, onSubmit }: ReportFormProps) {
  const [category, setCategory] = useState('');
  const [brand, setBrand] = useState('');
  const [colour, setColour] = useState('');
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('');
  const [dateTime, setDateTime] = useState('');
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string>('');
  const [identifyingInfo, setIdentifyingInfo] = useState('');
  const [privateFieldKey, setPrivateFieldKey] = useState('');
  const [privateFieldValue, setPrivateFieldValue] = useState('');
  const [loading, setLoading] = useState(false);

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setPhotoFile(file);
      setPhotoPreview(URL.createObjectURL(file));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      let photo_url = '';
      if (photoFile) {
        photo_url = await uploadPhoto(photoFile);
      }

      const baseData = {
        category,
        brand: brand || null,
        colour: colour || null,
        description,
        location,
        latitude: null,
        longitude: null,
        photo_url: photo_url || null,
      };

      if (type === 'lost') {
        await onSubmit({
          ...baseData,
          lost_at: new Date(dateTime).toISOString(),
          identifying_info: identifyingInfo || null,
        });
      } else {
        const private_details: Record<string, string> = {};
        if (privateFieldKey && privateFieldValue) {
          private_details[privateFieldKey] = privateFieldValue;
        }
        await onSubmit({
          ...baseData,
          found_at: new Date(dateTime).toISOString(),
          private_details,
        });
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Submission failed';
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const timeLabel = type === 'lost' ? 'When did you lose it?' : 'When did you find it?';

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-2xl mx-auto">
      {/* Photo Upload */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Photo</label>
        <div className="flex items-center gap-4">
          {photoPreview ? (
            <div className="relative w-32 h-32 rounded-lg overflow-hidden border">
              <img src={photoPreview} alt="Preview" className="w-full h-full object-cover" />
              <button
                type="button"
                onClick={() => { setPhotoFile(null); setPhotoPreview(''); }}
                className="absolute top-1 right-1 bg-black/50 text-white rounded-full p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <label className="w-32 h-32 border-2 border-dashed border-gray-300 rounded-lg flex flex-col items-center justify-center cursor-pointer hover:border-primary-400 transition-colors">
              <Camera className="w-8 h-8 text-gray-400" />
              <span className="text-xs text-gray-500 mt-1">Upload</span>
              <input type="file" accept="image/*" className="hidden" onChange={handlePhotoChange} />
            </label>
          )}
        </div>
      </div>

      {/* Description */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Description *</label>
        <textarea
          className="input-field h-28 resize-none"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Describe the item in detail — material, distinguishing features, contents..."
          required
          minLength={10}
        />
      </div>

      {/* Category / Brand / Colour row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Category *</label>
          <select className="input-field" value={category} onChange={(e) => setCategory(e.target.value)} required>
            <option value="">Select...</option>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Brand</label>
          <select className="input-field" value={brand} onChange={(e) => setBrand(e.target.value)}>
            <option value="">None</option>
            {BRANDS.map((b) => (
              <option key={b} value={b}>{b}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Colour</label>
          <select className="input-field" value={colour} onChange={(e) => setColour(e.target.value)}>
            <option value="">None</option>
            {COLOURS.map((c) => (
              <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Location */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Location *</label>
        <input
          type="text"
          className="input-field"
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          placeholder="e.g. Near Colombo Fort railway station"
          required
        />
      </div>

      {/* Date & Time */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">{timeLabel} *</label>
        <input
          type="datetime-local"
          className="input-field"
          value={dateTime}
          onChange={(e) => setDateTime(e.target.value)}
          required
        />
      </div>

      {/* Lost-only: Identifying Info */}
      {type === 'lost' && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Identifying Information <span className="text-gray-400">(private — only shown after verification)</span>
          </label>
          <input
            type="text"
            className="input-field"
            value={identifyingInfo}
            onChange={(e) => setIdentifyingInfo(e.target.value)}
            placeholder="e.g. Serial number, engraving, unique scratch"
          />
        </div>
      )}

      {/* Found-only: Private Details for verification */}
      {type === 'found' && (
        <div className="card bg-blue-50 border-blue-200">
          <p className="text-sm font-medium text-blue-800 mb-3">
            Add a private detail to verify the real owner (e.g. keychain colour, engraving text):
          </p>
          <div className="grid grid-cols-2 gap-3">
            <input
              type="text"
              className="input-field"
              value={privateFieldKey}
              onChange={(e) => setPrivateFieldKey(e.target.value)}
              placeholder="Field name (e.g. keychain_colour)"
            />
            <input
              type="text"
              className="input-field"
              value={privateFieldValue}
              onChange={(e) => setPrivateFieldValue(e.target.value)}
              placeholder="Answer (e.g. red)"
            />
          </div>
        </div>
      )}

      <button type="submit" className="btn-primary w-full text-lg py-3" disabled={loading}>
        {loading ? 'Submitting...' : type === 'lost' ? 'Report Lost Item' : 'Report Found Item'}
      </button>
    </form>
  );
}
