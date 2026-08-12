import * as ImagePicker from 'expo-image-picker';
import { useState } from 'react';
import { Alert, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { AppButton } from '@/components/AppButton';
import { AppTextInput } from '@/components/AppTextInput';
import { FACILITY_OPTIONS } from '@/constants/facilities';
import { ACADEMIC_DEPARTMENTS, DEPARTMENT_OPTIONS } from '@/constants/departments';
import { colors, fontSizes, radius, spacing } from '@/constants/theme';
import { normalizeVenueType, VENUE_TYPES } from '@/constants/venueTypes';
import { uploadHallImage } from '@/services/hallService';
import { Hall, HallFormInput } from '@/types/venue';

type HallFormProps = {
  initialHall?: Hall;
  submitLabel: string;
  submitting: boolean;
  onSubmit: (input: HallFormInput) => Promise<void>;
  lockedDepartment?: string;
  hideDepartment?: boolean;
  showAdminFields?: boolean;
};

type FormState = {
  name: string;
  department: string;
  venueType: string;
  location: string;
  block: string;
  floor: string;
  capacity: string;
  facilities: string[];
  imageUrl: string | null;
  isActive: boolean;
};

type FormErrors = Partial<Record<'name' | 'department' | 'venueType' | 'capacity', string>>;

export function HallForm({
  initialHall,
  submitLabel,
  submitting,
  onSubmit,
  lockedDepartment,
  hideDepartment,
  showAdminFields = true
}: HallFormProps) {
  const initialDepartment = lockedDepartment ?? initialHall?.department ?? '';
  const initialVenueType = normalizeVenueType(initialHall?.venueType);
  const [form, setForm] = useState<FormState>({
    name: initialHall?.name ?? '',
    department: initialDepartment,
    venueType: initialVenueType,
    location: initialHall?.location ?? '',
    block: initialHall?.block ?? '',
    floor: initialHall?.floor ?? '',
    capacity: initialHall?.capacity?.toString() ?? '',
    facilities: normalizeFacilities(initialHall?.facilities),
    imageUrl: initialHall?.imageUrl ?? null,
    isActive: initialHall?.isActive ?? true
  });
  const [errors, setErrors] = useState<FormErrors>({});
  const [uploading, setUploading] = useState(false);
  const venueTypeOptions = getFormVenueTypeOptions(form.venueType, form.department);

  const update = (key: keyof FormState) => (value: string) => {
    setForm((current) => ({ ...current, [key]: key === 'venueType' ? normalizeVenueType(value) : value }));
    setErrors((current) => ({ ...current, [key]: undefined }));
  };

  const toggleFacility = (facility: string) => {
    setForm((current) => ({
      ...current,
      facilities: current.facilities.includes(facility)
        ? current.facilities.filter((item) => item !== facility)
        : [...current.facilities, facility]
    }));
  };

  const showImagePicker = () => {
    Alert.alert('Hall Image', 'Choose how you want to add the venue image.', [
      { text: 'Take Photo', onPress: () => void takePhoto() },
      { text: 'Choose from Gallery', onPress: () => void chooseFromGallery() },
      { text: 'Cancel', style: 'cancel' }
    ]);
  };

  const takePhoto = async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Camera permission required', 'Please allow camera access to take a venue photo.');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.75
    });

    await uploadSelectedImage(result);
  };

  const chooseFromGallery = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permission required', 'Please allow photo access to upload a venue image.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.75
    });

    await uploadSelectedImage(result);
  };

  const uploadSelectedImage = async (result: ImagePicker.ImagePickerResult) => {
    if (result.canceled) return;

    const asset = result.assets[0];
    if (!asset?.uri) return;

    try {
      setUploading(true);
      const publicUrl = await uploadHallImage(asset.uri, asset.fileName ?? 'hall-image.jpg', asset.mimeType);
      setForm((current) => ({ ...current, imageUrl: publicUrl }));
    } catch (error) {
      Alert.alert('Image upload failed', 'Couldn’t upload the venue image. Please check your connection and try again.');
    } finally {
      setUploading(false);
    }
  };

  const validate = () => {
    const nextErrors: FormErrors = {};
    const capacity = Number(form.capacity);

    if (!form.name.trim()) nextErrors.name = 'Hall name is required.';
    if (!form.department.trim()) nextErrors.department = 'Department is required.';
    if (!form.venueType.trim()) nextErrors.venueType = 'Venue type is required.';
    if (!form.capacity.trim()) {
      nextErrors.capacity = 'Capacity is required.';
    } else if (!Number.isFinite(capacity) || capacity <= 0) {
      nextErrors.capacity = 'Capacity must be greater than 0.';
    }

    return nextErrors;
  };

  const handleSubmit = async () => {
    const nextErrors = validate();
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    await onSubmit({
      name: form.name,
      department: lockedDepartment ?? form.department,
      venueType: normalizeVenueType(form.venueType),
      location: form.location,
      block: form.block,
      floor: form.floor,
      capacity: Number(form.capacity),
      facilities: normalizeFacilities(form.facilities),
      imageUrl: form.imageUrl,
      isActive: form.isActive
    });
  };

  return (
    <View style={styles.wrap}>
      <AppTextInput label="Hall name" value={form.name} onChangeText={update('name')} error={errors.name} />
      {hideDepartment ? (
        <View style={styles.selector}>
          <Text style={styles.sectionTitle}>Department</Text>
          <Text style={styles.lockedText}>{form.department || 'Not assigned'}</Text>
        </View>
      ) : (
        <SelectorSection
          title="Department"
          options={DEPARTMENT_OPTIONS}
          value={form.department}
          error={errors.department}
          onSelect={(department) => update('department')(department)}
        />
      )}
      <SelectorSection
        title="Venue type"
        options={venueTypeOptions}
        value={form.venueType}
        error={errors.venueType}
        onSelect={(venueType) => update('venueType')(venueType)}
      />
      {showAdminFields ? (
        <>
          <AppTextInput label="Block" value={form.block} onChangeText={update('block')} />
          <AppTextInput label="Floor" value={form.floor} onChangeText={update('floor')} />
        </>
      ) : null}
      <AppTextInput label="Capacity" value={form.capacity} onChangeText={update('capacity')} keyboardType="number-pad" error={errors.capacity} />

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Facilities</Text>
        <Text style={styles.sectionHint}>Recommended, but not mandatory.</Text>
        <View style={styles.chips}>
          {FACILITY_OPTIONS.map((facility) => {
            const active = form.facilities.includes(facility);
            return (
              <Pressable key={facility} onPress={() => toggleFacility(facility)} style={[styles.chip, active && styles.chipActive]}>
                <Text style={[styles.chipText, active && styles.chipTextActive]}>{facility}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      {showAdminFields ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Hall image</Text>
          {form.imageUrl ? <Image source={{ uri: form.imageUrl }} style={styles.image} /> : <View style={styles.imagePlaceholder} />}
          <AppButton title={uploading ? 'Uploading...' : 'Upload Image'} variant="secondary" loading={uploading} disabled={uploading} onPress={showImagePicker} />
        </View>
      ) : null}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Active status</Text>
        <View style={styles.statusRow}>
          <Pressable onPress={() => setForm((current) => ({ ...current, isActive: true }))} style={[styles.statusChoice, form.isActive && styles.statusActive]}>
            <Text style={[styles.statusText, form.isActive && styles.statusTextActive]}>Active</Text>
          </Pressable>
          <Pressable onPress={() => setForm((current) => ({ ...current, isActive: false }))} style={[styles.statusChoice, !form.isActive && styles.statusActive]}>
            <Text style={[styles.statusText, !form.isActive && styles.statusTextActive]}>Inactive</Text>
          </Pressable>
        </View>
      </View>

      <AppButton title={submitLabel} loading={submitting} disabled={submitting || uploading} onPress={handleSubmit} />
    </View>
  );
}

function getFormVenueTypeOptions(value: string, department: string) {
  const normalizedValue = normalizeVenueType(value);
  const baseOptions = getVenueTypesForDepartment(department);
  if (normalizedValue && !baseOptions.includes(normalizedValue as (typeof baseOptions)[number])) {
    return [...baseOptions, `Existing: ${normalizedValue}`];
  }
  return [...baseOptions];
}

function getVenueTypesForDepartment(department: string) {
  if (!ACADEMIC_DEPARTMENTS.includes(department)) return VENUE_TYPES;

  return VENUE_TYPES.filter((type) => !['Open Hall', 'Auditorium', 'Dining Hall'].includes(type));
}

function normalizeFacilities(facilities?: string[] | null) {
  const allowedFacilities = new Set<string>(FACILITY_OPTIONS);
  return Array.from(new Set((facilities ?? []).filter((facility) => allowedFacilities.has(facility))));
}

function SelectorSection({
  title,
  options,
  value,
  error,
  onSelect
}: {
  title: string;
  options: string[];
  value: string;
  error?: string;
  onSelect: (value: string) => void;
}) {
  return (
    <View style={styles.selector}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.chips}>
        {options.map((option) => {
          const optionValue = option.replace(/^Existing: /, '');
          const active = value === optionValue;
          return (
            <Pressable key={option} onPress={() => onSelect(optionValue)} style={[styles.chip, active && styles.chipActive]}>
              <Text style={[styles.chipText, active && styles.chipTextActive]}>{option}</Text>
            </Pressable>
          );
        })}
      </View>
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: spacing.md
  },
  section: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.md,
    gap: spacing.md
  },
  selector: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.md,
    gap: spacing.md
  },
  sectionTitle: {
    color: colors.text,
    fontSize: fontSizes.md,
    fontWeight: '900'
  },
  sectionHint: {
    color: colors.textMuted,
    fontSize: fontSizes.sm,
    fontWeight: '600'
  },
  lockedText: {
    color: colors.primary,
    fontSize: fontSizes.md,
    fontWeight: '900'
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm
  },
  chip: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.surface
  },
  chipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary
  },
  chipText: {
    color: colors.textMuted,
    fontSize: fontSizes.sm,
    fontWeight: '800'
  },
  chipTextActive: {
    color: colors.surface
  },
  image: {
    width: '100%',
    height: 180,
    borderRadius: radius.md,
    backgroundColor: colors.primaryLight
  },
  imagePlaceholder: {
    height: 120,
    borderRadius: radius.md,
    backgroundColor: colors.primaryLight
  },
  statusRow: {
    flexDirection: 'row',
    gap: spacing.md
  },
  statusChoice: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    alignItems: 'center'
  },
  statusActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary
  },
  statusText: {
    color: colors.textMuted,
    fontSize: fontSizes.sm,
    fontWeight: '900'
  },
  statusTextActive: {
    color: colors.surface
  },
  errorText: {
    color: colors.status.rejected,
    fontSize: fontSizes.xs,
    fontWeight: '800'
  }
});
