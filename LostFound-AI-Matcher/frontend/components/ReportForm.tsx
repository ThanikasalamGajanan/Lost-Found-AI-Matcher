'use client';

import { useEffect, useMemo, useState } from 'react';
import { CATEGORIES, COLOURS, BRANDS } from '@/types';
import { reportsApi } from '@/lib/api';
import { useAuthStore } from '@/lib/store';
import {
  Camera,
  X,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Globe,
  MapPin,
  CalendarClock,
  FileText,
  Tag,
  PackageOpen,
  Lock,
} from 'lucide-react';
import Image from 'next/image';
import toast from 'react-hot-toast';

type Lang = 'en' | 'ta' | 'si';
type FormType = 'lost' | 'found';

interface ReportFormProps {
  type: FormType;
  onSubmit: (data: Record<string, unknown>) => Promise<void>;
}

interface FormErrors {
  category?: string;
  description?: string;
  location?: string;
  dateTime?: string;
  privateField?: string;
  photo?: string;
}

const translations: Record<Lang, Record<string, string>> = {
  en: {
    titleLost: 'Report Lost Item',
    titleFound: 'Report Found Item',
    languageLabel: 'Language',
    photoLabel: 'Photo',
    uploadText: 'Upload a photo',
    changePhoto: 'Change photo',
    descriptionLabel: 'Description *',
    descriptionPlaceholder:
      'Describe the item in detail — material, distinguishing features, contents...',
    descriptionHint: 'Minimum 10 characters',
    categoryLabel: 'Category *',
    categoryPlaceholder: 'Select category',
    brandLabel: 'Brand',
    brandPlaceholder: 'None',
    colourLabel: 'Colour',
    colourPlaceholder: 'None',
    locationLabel: 'Location *',
    locationPlaceholder: 'e.g. Near Colombo Fort railway station',
    dateTimeLabelLost: 'When did you lose it? *',
    dateTimeLabelFound: 'When did you find it? *',
    identifyingInfoLabel: 'Identifying Information',
    identifyingInfoHint: 'Private — only shown after verification',
    identifyingInfoPlaceholder: 'e.g. Serial number, engraving, unique scratch',
    privateDetailsTitle: 'Private verification detail',
    privateDetailsHint:
      'Add a private detail to verify the real owner (e.g. keychain colour, engraving text):',
    privateFieldKeyPlaceholder: 'Field name (e.g. keychain_colour)',
    privateFieldValuePlaceholder: 'Answer (e.g. red)',
    submitLost: 'Report Lost Item',
    submitFound: 'Report Found Item',
    submitting: 'Submitting...',
    successTitle: 'Report submitted!',
    successMessage: "Thank you. We're searching for matches now.",
    reportAnother: 'Report another item',
    errorRequired: 'This field is required',
    errorMinDescription: 'Description must be at least 10 characters',
    errorPrivatePair:
      'Please provide both a field name and an answer, or leave both empty',
    errorPhotoSize: 'Photo must be under 5 MB',
    errorPhotoType: 'Please upload an image file',
  },
  ta: {
    titleLost: 'இழந்த பொருளைப் பதிவு செய்யுங்கள்',
    titleFound: 'கண்டெடுத்த பொருளைப் பதிவு செய்யுங்கள்',
    languageLabel: 'மொழி',
    photoLabel: 'புகைப்படம்',
    uploadText: 'புகைப்படத்தை பதிவேற்றவும்',
    changePhoto: 'புகைப்படத்தை மாற்றவும்',
    descriptionLabel: 'விவரம் *',
    descriptionPlaceholder:
      'பொருளை விரிவாக விவரிக்கவும் — பொருள், பிரத்யேக அம்சங்கள், உள்ளடக்கங்கள்...',
    descriptionHint: 'குறைந்தது 10 எழுத்துகள்',
    categoryLabel: 'வகை *',
    categoryPlaceholder: 'வகையைத் தேர்ந்தெடுக்கவும்',
    brandLabel: 'வர்த்தகப்பெயர்',
    brandPlaceholder: 'எதுவும் இல்லை',
    colourLabel: 'நிறம்',
    colourPlaceholder: 'எதுவும் இல்லை',
    locationLabel: 'இடம் *',
    locationPlaceholder: 'எ.கா. கொழும்பு கோட்டை ரயில் நிலையத்திற்கு அருகில்',
    dateTimeLabelLost: 'நீங்கள் எப்போது இழந்தீர்கள்? *',
    dateTimeLabelFound: 'நீங்கள் எப்போது கண்டெடுத்தீர்கள்? *',
    identifyingInfoLabel: 'அடையாளத் தகவல்',
    identifyingInfoHint: 'தனிப்பட்டது — சரிபார்ப்புக்குப் பிறகு மட்டுமே காட்டப்படும்',
    identifyingInfoPlaceholder: 'எ.கா. வரிசை எண், கொள்ளையிடுதல், தனித்துவமான சிராச்சு',
    privateDetailsTitle: 'தனிப்பட்ட சரிபார்ப்பு விவரம்',
    privateDetailsHint:
      'உண்மையான உரிமையாளரைச் சரிபார்க்க ஒரு தனிப்பட்ட விவரத்தைச் சேர்க்கவும் (எ.கா. சாவித் தொடரி நிறம், கொள்ளையிடும் உரை):',
    privateFieldKeyPlaceholder: 'புலம் பெயர் (எ.கா. keychain_colour)',
    privateFieldValuePlaceholder: 'பதில் (எ.கா. சிவப்பு)',
    submitLost: 'இழந்த பொருளைப் பதிவு செய்யுங்கள்',
    submitFound: 'கண்டெடுத்த பொருளைப் பதிவு செய்யுங்கள்',
    submitting: 'சமர்ப்பிக்கப்படுகிறது...',
    successTitle: 'அறிக்கை சமர்ப்பிக்கப்பட்டது!',
    successMessage: 'நன்றி. எங்கள் பொருத்தங்களைத் தேடுகிறோம்.',
    reportAnother: 'மற்றொரு பொருளைப் பதிவு செய்யுங்கள்',
    errorRequired: 'இந்த புலம் தேவை',
    errorMinDescription: 'விவரம் குறைந்தது 10 எழுத்துகளாக இருக்க வேண்டும்',
    errorPrivatePair:
      'தயவுசெய்து புலம் பெயர் மற்றும் பதில் இரண்டையும் வழங்கவும், அல்லது இரண்டையும் காலியாக விடவும்',
    errorPhotoSize: 'புகைப்படம் 5 MB க்கு கீழ் இருக்க வேண்டும்',
    errorPhotoType: 'தயவுசெய்து பட கோப்பை பதிவேற்றவும்',
  },
  si: {
    titleLost: 'නැති වූ භාණ්ඩයක් වාර්තා කරන්න',
    titleFound: 'සොයාගත් භාණ්ඩයක් වාර්තා කරන්න',
    languageLabel: 'භාෂාව',
    photoLabel: 'පින්තූරය',
    uploadText: 'පින්තූරයක් උඩුගත කරන්න',
    changePhoto: 'පින්තූරය වෙනස් කරන්න',
    descriptionLabel: 'විස්තරය *',
    descriptionPlaceholder:
      'භාණ්ඩය විස්තරාත්මකව විස්තර කරන්න — ද්‍රව්‍ය, වෙනස් කළ හැකි ලක්ෂණ, අන්තර්ගතය...',
    descriptionHint: 'අවම වශයෙන් අකුරු 10කි',
    categoryLabel: 'වර්ගය *',
    categoryPlaceholder: 'වර්ගය තෝරන්න',
    brandLabel: 'වෙළඳ නාමය',
    brandPlaceholder: 'නැත',
    colourLabel: 'වර්ණය',
    colourPlaceholder: 'නැත',
    locationLabel: 'ස්ථානය *',
    locationPlaceholder: 'උදා. කොළඹ කොටුව දුම්රිය ස්ථානය අසල',
    dateTimeLabelLost: 'ඔබ එය නැති වූයේ කවදාද? *',
    dateTimeLabelFound: 'ඔබ එය සොයාගත්තේ කවදාද? *',
    identifyingInfoLabel: 'හඳුනාගැනීමේ තොරතුරු',
    identifyingInfoHint: 'පුද්ගලික — සත්‍යාපනයෙන් පසු පමණක් පෙන්වයි',
    identifyingInfoPlaceholder: 'උදා. අනුක්‍රමික අංකය, කැටයම, අද්විතීය සලකුණ',
    privateDetailsTitle: 'පුද්ගලික සත්‍යාපන විස්තරය',
    privateDetailsHint:
      'සැබෑ හිමිකරු සත්‍යාපනය කිරීමට පුද්ගලික විස්තරයක් එකතු කරන්න (උදා. යතුරු කට්ටලයේ වර්ණය, කැටයම් පාඨය):',
    privateFieldKeyPlaceholder: 'ක්ෂේත්‍ර නාමය (උදා. keychain_colour)',
    privateFieldValuePlaceholder: 'පිළිතුර (උදා. රතු)',
    submitLost: 'නැති වූ භාණ්ඩයක් වාර්තා කරන්න',
    submitFound: 'සොයාගත් භාණ්ඩයක් වාර්තා කරන්න',
    submitting: 'ඉදිරිපත් කරමින්...',
    successTitle: 'වාර්තාව ඉදිරිපත් කරන ලදී!',
    successMessage: 'ඔබට ස්තුතියි. අපි දැන් ගැළපීම් සොයමින් සිටිමු.',
    reportAnother: 'වෙනත් භාණ්ඩයක් වාර්තා කරන්න',
    errorRequired: 'මෙම ක්ෂේත්‍රය අවශ්‍යයි',
    errorMinDescription: 'විස්තරය අවම වශයෙන් අකුරු 10කි විය යුතුය',
    errorPrivatePair:
      'කරුණාකර ක්ෂේත්‍ර නාමය සහ පිළිතුර දෙකම ලබා දෙන්න, නැතහොත් දෙකම හිස්ව තබන්න',
    errorPhotoSize: 'පින්තූරය MB 5 ට අඩු විය යුතුය',
    errorPhotoType: 'කරුණාකර පින්තූර ගොනුවක් උඩුගත කරන්න',
  },
};

const MAX_PHOTO_SIZE_MB = 5;

export function ReportForm({ type, onSubmit }: ReportFormProps) {
  const { user } = useAuthStore();
  const [lang, setLang] = useState<Lang>(user?.preferred_lang ?? 'en');

  const [category, setCategory] = useState('');
  const [brand, setBrand] = useState('');
  const [colour, setColour] = useState('');
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('');
  const [dateTime, setDateTime] = useState('');
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState('');
  const [identifyingInfo, setIdentifyingInfo] = useState('');
  const [privateFieldKey, setPrivateFieldKey] = useState('');
  const [privateFieldValue, setPrivateFieldValue] = useState('');

  const [errors, setErrors] = useState<FormErrors>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const t = translations[lang];

  // Keep language in sync if the user's preference changes.
  useEffect(() => {
    if (user?.preferred_lang && ['en', 'ta', 'si'].includes(user.preferred_lang)) {
      setLang(user.preferred_lang as Lang);
    }
  }, [user?.preferred_lang]);

  const validateField = useMemo(
    () =>
      (name: keyof FormErrors, value?: string): string | undefined => {
        switch (name) {
          case 'category':
            return !category ? t.errorRequired : undefined;
          case 'description':
            if (!description.trim()) return t.errorRequired;
            if (description.trim().length < 10) return t.errorMinDescription;
            return undefined;
          case 'location':
            return !location.trim() ? t.errorRequired : undefined;
          case 'dateTime':
            return !dateTime ? t.errorRequired : undefined;
          case 'privateField':
            if (type !== 'found') return undefined;
            if ((privateFieldKey && !privateFieldValue) || (!privateFieldKey && privateFieldValue)) {
              return t.errorPrivatePair;
            }
            return undefined;
          default:
            return undefined;
        }
      },
    [category, description, location, dateTime, privateFieldKey, privateFieldValue, type, t]
  );

  const validateAll = (): boolean => {
    const next: FormErrors = {
      category: validateField('category'),
      description: validateField('description'),
      location: validateField('location'),
      dateTime: validateField('dateTime'),
      privateField: validateField('privateField'),
    };
    setErrors(next);
    setTouched({
      category: true,
      description: true,
      location: true,
      dateTime: true,
      privateField: true,
    });
    return Object.values(next).every((e) => !e);
  };

  const handleBlur = (field: keyof FormErrors) => {
    setTouched((prev) => ({ ...prev, [field]: true }));
    setErrors((prev) => ({ ...prev, [field]: validateField(field) }));
  };

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    setErrors((prev) => ({ ...prev, photo: undefined }));

    if (!file) {
      setPhotoFile(null);
      setPhotoPreview('');
      return;
    }

    if (!file.type.startsWith('image/')) {
      setErrors((prev) => ({ ...prev, photo: t.errorPhotoType }));
      return;
    }

    if (file.size > MAX_PHOTO_SIZE_MB * 1024 * 1024) {
      setErrors((prev) => ({ ...prev, photo: t.errorPhotoSize }));
      return;
    }

    setPhotoFile(file);
    const reader = new FileReader();
    reader.onloadend = () => setPhotoPreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const clearPhoto = () => {
    setPhotoFile(null);
    setPhotoPreview('');
    setErrors((prev) => ({ ...prev, photo: undefined }));
  };

  const resetForm = () => {
    setCategory('');
    setBrand('');
    setColour('');
    setDescription('');
    setLocation('');
    setDateTime('');
    setPhotoFile(null);
    setPhotoPreview('');
    setIdentifyingInfo('');
    setPrivateFieldKey('');
    setPrivateFieldValue('');
    setErrors({});
    setTouched({});
    setSuccess(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateAll()) {
      toast.error('Please fix the errors in the form');
      return;
    }

    setLoading(true);

    try {
      let photo_url: string | null = null;
      if (photoFile) {
        const { photo_url: url } = await reportsApi.uploadPhoto(photoFile);
        photo_url = url;
      }

      const baseData = {
        category,
        brand: brand || null,
        colour: colour || null,
        description,
        location,
        latitude: null,
        longitude: null,
        photo_url,
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

      setSuccess(true);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Submission failed';
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const renderError = (field: keyof FormErrors) => {
    const message = errors[field];
    if (!message || !touched[field]) return null;
    return (
      <div className="flex items-center gap-1.5 mt-1.5 text-xs text-red-600">
        <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
        <span>{message}</span>
      </div>
    );
  };

  const inputErrorClass = (field: keyof FormErrors) =>
    errors[field] && touched[field] ? 'border-red-500 focus:border-red-500 focus:ring-red-500' : '';

  if (success) {
    return (
      <div className="card max-w-2xl mx-auto text-center py-10 sm:py-14 animate-in fade-in zoom-in duration-300">
        <div className="w-16 h-16 sm:w-20 sm:h-20 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-5">
          <CheckCircle2 className="w-8 h-8 sm:w-10 sm:h-10" />
        </div>
        <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-2">{t.successTitle}</h2>
        <p className="text-sm sm:text-base text-gray-600 mb-7">{t.successMessage}</p>
        <button type="button" onClick={resetForm} className="btn-primary text-sm sm:text-base">
          {t.reportAnother}
        </button>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-5 sm:space-y-6 max-w-2xl mx-auto"
      noValidate
    >
      {/* Header + language toggle */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-2 border-b border-gray-100">
        <h2 className="text-xl sm:text-2xl font-bold text-gray-900">
          {type === 'lost' ? t.titleLost : t.titleFound}
        </h2>

        <div className="flex items-center gap-2">
          <Globe className="w-4 h-4 text-gray-500" />
          <span className="text-xs sm:text-sm text-gray-500">{t.languageLabel}</span>
          <div className="inline-flex rounded-lg border border-gray-200 overflow-hidden">
            {(['en', 'ta', 'si'] as Lang[]).map((l) => (
              <button
                key={l}
                type="button"
                onClick={() => setLang(l)}
                className={`px-2.5 py-1 text-xs sm:text-sm font-medium transition-colors ${
                  lang === l
                    ? 'bg-primary-600 text-white'
                    : 'bg-white text-gray-600 hover:bg-gray-50'
                }`}
              >
                {l.toUpperCase()}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Photo Upload */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">{t.photoLabel}</label>
        <div className="flex items-center gap-4">
          {photoPreview ? (
            <div className="relative w-28 h-28 sm:w-32 sm:h-32 rounded-xl overflow-hidden border border-gray-200 shadow-sm">
              <Image
                src={photoPreview}
                alt="Preview"
                fill
                className="object-cover"
                sizes="128px"
              />
              <button
                type="button"
                onClick={clearPhoto}
                className="absolute top-1.5 right-1.5 bg-black/60 hover:bg-black/80 text-white rounded-full p-1 transition-colors"
                aria-label={t.changePhoto}
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <label className="w-28 h-28 sm:w-32 sm:h-32 border-2 border-dashed border-gray-300 rounded-xl flex flex-col items-center justify-center cursor-pointer hover:border-primary-400 hover:bg-primary-50/50 transition-colors">
              <Camera className="w-7 h-7 sm:w-8 sm:h-8 text-gray-400" />
              <span className="text-xs text-gray-500 mt-1.5 text-center px-2">{t.uploadText}</span>
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handlePhotoChange}
              />
            </label>
          )}
        </div>
        {renderError('photo')}
      </div>

      {/* Description */}
      <div>
        <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-1.5">
          <FileText className="w-4 h-4 text-gray-400" />
          {t.descriptionLabel}
        </label>
        <textarea
          className={`input-field h-28 resize-none text-sm sm:text-base ${inputErrorClass(
            'description'
          )}`}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          onBlur={() => handleBlur('description')}
          placeholder={t.descriptionPlaceholder}
          disabled={loading}
        />
        <div className="flex items-center justify-between mt-1.5">
          <span className="text-xs text-gray-400">{t.descriptionHint}</span>
          {renderError('description')}
        </div>
      </div>

      {/* Category / Brand / Colour row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div>
          <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-1.5">
            <Tag className="w-4 h-4 text-gray-400" />
            {t.categoryLabel}
          </label>
          <select
            className={`input-field text-sm sm:text-base ${inputErrorClass('category')}`}
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            onBlur={() => handleBlur('category')}
            disabled={loading}
          >
            <option value="">{t.categoryPlaceholder}</option>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c.charAt(0).toUpperCase() + c.slice(1)}
              </option>
            ))}
          </select>
          {renderError('category')}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">{t.brandLabel}</label>
          <select
            className="input-field text-sm sm:text-base"
            value={brand}
            onChange={(e) => setBrand(e.target.value)}
            disabled={loading}
          >
            <option value="">{t.brandPlaceholder}</option>
            {BRANDS.map((b) => (
              <option key={b} value={b}>
                {b}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">{t.colourLabel}</label>
          <select
            className="input-field text-sm sm:text-base"
            value={colour}
            onChange={(e) => setColour(e.target.value)}
            disabled={loading}
          >
            <option value="">{t.colourPlaceholder}</option>
            {COLOURS.map((c) => (
              <option key={c} value={c}>
                {c.charAt(0).toUpperCase() + c.slice(1)}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Location */}
      <div>
        <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-1.5">
          <MapPin className="w-4 h-4 text-gray-400" />
          {t.locationLabel}
        </label>
        <input
          type="text"
          className={`input-field text-sm sm:text-base ${inputErrorClass('location')}`}
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          onBlur={() => handleBlur('location')}
          placeholder={t.locationPlaceholder}
          disabled={loading}
        />
        {renderError('location')}
      </div>

      {/* Date & Time */}
      <div>
        <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-1.5">
          <CalendarClock className="w-4 h-4 text-gray-400" />
          {type === 'lost' ? t.dateTimeLabelLost : t.dateTimeLabelFound}
        </label>
        <input
          type="datetime-local"
          className={`input-field text-sm sm:text-base ${inputErrorClass('dateTime')}`}
          value={dateTime}
          onChange={(e) => setDateTime(e.target.value)}
          onBlur={() => handleBlur('dateTime')}
          disabled={loading}
        />
        {renderError('dateTime')}
      </div>

      {/* Lost-only: Identifying Info */}
      {type === 'lost' && (
        <div className="card bg-amber-50/60 border-amber-100 py-4 sm:py-5">
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            {t.identifyingInfoLabel}{' '}
            <span className="text-gray-400 font-normal">({t.identifyingInfoHint})</span>
          </label>
          <input
            type="text"
            className="input-field text-sm sm:text-base"
            value={identifyingInfo}
            onChange={(e) => setIdentifyingInfo(e.target.value)}
            placeholder={t.identifyingInfoPlaceholder}
            disabled={loading}
          />
        </div>
      )}

      {/* Found-only: Private Details for verification */}
      {type === 'found' && (
        <div className="card bg-blue-50/60 border-blue-100 py-4 sm:py-5">
          <div className="flex items-start gap-2 mb-3">
            <Lock className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
            <p className="text-sm font-medium text-blue-800 leading-relaxed">
              {t.privateDetailsHint}
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <input
              type="text"
              className="input-field text-sm sm:text-base"
              value={privateFieldKey}
              onChange={(e) => setPrivateFieldKey(e.target.value)}
              onBlur={() => handleBlur('privateField')}
              placeholder={t.privateFieldKeyPlaceholder}
              disabled={loading}
            />
            <input
              type="text"
              className="input-field text-sm sm:text-base"
              value={privateFieldValue}
              onChange={(e) => setPrivateFieldValue(e.target.value)}
              onBlur={() => handleBlur('privateField')}
              placeholder={t.privateFieldValuePlaceholder}
              disabled={loading}
            />
          </div>
          {renderError('privateField')}
        </div>
      )}

      {/* Submit */}
      <button
        type="submit"
        className="btn-primary w-full text-base sm:text-lg py-3 min-h-[52px] flex items-center justify-center gap-2"
        disabled={loading}
      >
        {loading ? (
          <>
            <Loader2 className="w-5 h-5 animate-spin" />
            {t.submitting}
          </>
        ) : (
          <>
            <PackageOpen className="w-5 h-5" />
            {type === 'lost' ? t.submitLost : t.submitFound}
          </>
        )}
      </button>
    </form>
  );
}
