import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { space } from '../constants/tokens';
import {
  Badge, Button, Card, Chip, Divider, EmptyState, IconButton, Input, ListRow, SectionHeader,
  SegmentedControl, Sheet, Text, useTheme, useToast,
} from '../components/ui';
import { catalogAction } from '../services/catalogAdmin';
import {
  CATEGORIES, CHECK_STATUSES, RATE_PERIODS, REGULATORS, REGULATORS_BY_CATEGORY, currentRegulators, describeRate,
  hostOf, isCurrentLicence, latestChecks, listingBlockers, parseNumber, shortDate, todayInLagos,
} from '../services/catalogRules';

const STATUS_OPTIONS = [
  { value: 'draft', label: 'Draft' },
  { value: 'published', label: 'Published' },
  { value: 'archived', label: 'Archived' },
];

const STATUS_TONE = { draft: 'neutral', published: 'positive', archived: 'warning' };
const STATUS_LABEL = { draft: 'Draft', published: 'Published', archived: 'Archived' };

const labelOf = (options, value) => options.find(o => o.value === value)?.label || value;
const asText = value => (value === null || value === undefined ? '' : String(value));

function ChoiceRow({ label, options, value, onChange }) {
  return (
    <View style={{ gap: space.xs }}>
      <Text variant="label">{label}</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
        {options.map(option => (
          <Chip key={option.value} label={option.label} selected={option.value === value} onPress={() => onChange(option.value)} />
        ))}
      </View>
    </View>
  );
}

// Every form shares the same frame: scrolling fields, an error, then save or cancel.
function FormSheet({ title, onClose, onSave, saveLabel = 'Save', children }) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function save() {
    setSaving(true);
    setError('');
    try {
      await onSave();
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  }

  return (
    <Sheet
      visible
      onClose={onClose}
      title={title}
      footer={(
        <>
          {error ? <Text variant="label" color="negative" accessibilityLiveRegion="polite">{error}</Text> : null}
          <Button full title={saveLabel} loading={saving} onPress={save} />
          <Button full title="Cancel" variant="ghost" onPress={onClose} />
        </>
      )}
    >
      <ScrollView style={{ flexShrink: 1 }} keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: space.md }}>
        {children}
      </ScrollView>
    </Sheet>
  );
}

function requireNumber(text, label) {
  const value = parseNumber(text);
  if (Number.isNaN(value)) throw new Error(`${label} must be a number.`);
  return value;
}

function ProviderForm({ provider, onClose, onSaved }) {
  const [name, setName] = useState(asText(provider?.name));
  const [website, setWebsite] = useState(asText(provider?.website_url));
  const [logo, setLogo] = useState(asText(provider?.logo_url));
  return (
    <FormSheet
      title={provider ? 'Edit provider' : 'Add provider'}
      onClose={onClose}
      onSave={async () => {
        const { row } = await catalogAction('save_provider', {
          id: provider?.id, name, website_url: website.trim(), logo_url: logo.trim(),
        });
        onSaved(provider ? 'Provider saved.' : 'Provider added as a draft.', row.id);
      }}
    >
      <Input label="Name" value={name} onChangeText={setName} />
      <Input label="Website" value={website} onChangeText={setWebsite} placeholder="https://" autoCapitalize="none" autoCorrect={false} keyboardType="url" />
      <Input label="Logo link" value={logo} onChangeText={setLogo} hint="Optional" placeholder="https://" autoCapitalize="none" autoCorrect={false} keyboardType="url" />
    </FormSheet>
  );
}

function ProductForm({ product, providerId, onClose, onSaved }) {
  const [category, setCategory] = useState(product?.category || 'loan');
  const [name, setName] = useState(asText(product?.name));
  const [currency, setCurrency] = useState(product?.currency || 'NGN');
  const [minAmount, setMinAmount] = useState(asText(product?.min_amount));
  const [maxAmount, setMaxAmount] = useState(asText(product?.max_amount));
  const [minTenor, setMinTenor] = useState(asText(product?.min_tenor_days));
  const [maxTenor, setMaxTenor] = useState(asText(product?.max_tenor_days));
  const [fees, setFees] = useState(asText(product?.fees));
  const [terms, setTerms] = useState((product?.key_terms || []).join('\n'));
  const [referral, setReferral] = useState(asText(product?.referral_url));
  const isFx = category === 'fx';
  return (
    <FormSheet
      title={product ? 'Edit product' : 'Add product'}
      onClose={onClose}
      onSave={async () => {
        await catalogAction('save_product', {
          id: product?.id,
          provider_id: providerId,
          category,
          name,
          currency: currency.trim().toUpperCase(),
          min_amount: requireNumber(minAmount, 'Minimum amount'),
          max_amount: requireNumber(maxAmount, 'Maximum amount'),
          min_tenor_days: isFx ? null : requireNumber(minTenor, 'Shortest term'),
          max_tenor_days: isFx ? null : requireNumber(maxTenor, 'Longest term'),
          fees,
          key_terms: terms.split('\n').map(t => t.trim()).filter(Boolean),
          referral_url: referral.trim(),
        });
        onSaved(product ? 'Product saved.' : 'Product added as a draft.');
      }}
    >
      {product
        ? <Text variant="label" color="inkMuted">{`${labelOf(CATEGORIES, category)} products stay in that category.`}</Text>
        : (
          <ChoiceRow
            label="Category"
            options={CATEGORIES}
            value={category}
            onChange={next => {
              setCategory(next);
              // FX rates are quoted in naira, so the product is the other currency.
              if (next === 'fx' && currency === 'NGN') setCurrency('USD');
              if (next !== 'fx' && category === 'fx' && currency === 'USD') setCurrency('NGN');
            }}
          />
        )}
      <Input label="Name" value={name} onChangeText={setName} />
      <Input
        label={isFx ? 'Currency exchanged against naira' : 'Currency'}
        value={currency}
        onChangeText={setCurrency}
        autoCapitalize="characters"
        maxLength={3}
        placeholder={isFx ? 'USD' : 'NGN'}
      />
      <Input label="Minimum amount" value={minAmount} onChangeText={setMinAmount} keyboardType="decimal-pad" hint="Optional" />
      <Input label="Maximum amount" value={maxAmount} onChangeText={setMaxAmount} keyboardType="decimal-pad" hint="Optional" />
      {isFx ? null : (
        <>
          <Input label="Shortest term, in days" value={minTenor} onChangeText={setMinTenor} keyboardType="number-pad" hint="Optional" />
          <Input label="Longest term, in days" value={maxTenor} onChangeText={setMaxTenor} keyboardType="number-pad" hint="Optional" />
        </>
      )}
      <Input label="Fees" value={fees} onChangeText={setFees} multiline hint="Optional" />
      <Input label="Key terms" value={terms} onChangeText={setTerms} multiline hint="One per line. Optional." />
      <Input
        label="Referral link"
        value={referral}
        onChangeText={setReferral}
        placeholder="https://"
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="url"
        hint="Only if FinSight is paid for the click. The app tells users, and it never changes the ranking."
      />
    </FormSheet>
  );
}

function RateForm({ product, rate, onClose, onSaved }) {
  const isFx = product.category === 'fx';
  const [min, setMin] = useState(asText(rate?.rate_min_pct));
  const [max, setMax] = useState(asText(rate?.rate_max_pct));
  const [period, setPeriod] = useState(rate?.rate_period || 'annual');
  const [buy, setBuy] = useState(asText(rate?.buy_rate));
  const [sell, setSell] = useState(asText(rate?.sell_rate));
  const [source, setSource] = useState(asText(rate?.source_url));
  const [checkedOn, setCheckedOn] = useState(todayInLagos());
  return (
    <FormSheet
      title={`Rate for ${product.name}`}
      onClose={onClose}
      onSave={async () => {
        await catalogAction('save_rate', {
          product_id: product.id,
          source_url: source.trim(),
          checked_on: checkedOn.trim(),
          ...(isFx
            ? { buy_rate: requireNumber(buy, 'Buy rate'), sell_rate: requireNumber(sell, 'Sell rate') }
            : {
              rate_min_pct: requireNumber(min, 'Lowest rate'),
              rate_max_pct: requireNumber(max, 'Highest rate'),
              rate_period: period,
            }),
        });
        onSaved('Rate saved.');
      }}
    >
      {isFx ? (
        <>
          <Input label={`Buy rate, naira per ${product.currency}`} value={buy} onChangeText={setBuy} keyboardType="decimal-pad" />
          <Input label={`Sell rate, naira per ${product.currency}`} value={sell} onChangeText={setSell} keyboardType="decimal-pad" />
        </>
      ) : (
        <>
          <Input label="Lowest rate, %" value={min} onChangeText={setMin} keyboardType="decimal-pad" hint={'Enter 0 if the provider only publishes an "up to" rate.'} />
          <Input label="Highest rate, %" value={max} onChangeText={setMax} keyboardType="decimal-pad" hint="Leave blank if there's one rate." />
          <ChoiceRow label="The rate is quoted per" options={RATE_PERIODS} value={period} onChange={setPeriod} />
        </>
      )}
      <Input label="Where this rate is published" value={source} onChangeText={setSource} placeholder="https://" autoCapitalize="none" autoCorrect={false} keyboardType="url" />
      <Input label="Date you checked it" value={checkedOn} onChangeText={setCheckedOn} placeholder="YYYY-MM-DD" hint="Users see this as the last-updated date." />
    </FormSheet>
  );
}

function CheckForm({ provider, onClose, onSaved }) {
  const [regulator, setRegulator] = useState('CBN');
  const [status, setStatus] = useState('verified');
  const [type, setType] = useState('');
  const [number, setNumber] = useState('');
  const [source, setSource] = useState('');
  const [checkedOn, setCheckedOn] = useState(todayInLagos());
  const [expiresOn, setExpiresOn] = useState('');
  const [notes, setNotes] = useState('');
  return (
    <FormSheet
      title={`Licence check for ${provider.name}`}
      saveLabel="Add check"
      onClose={onClose}
      onSave={async () => {
        await catalogAction('add_check', {
          provider_id: provider.id,
          regulator,
          status,
          licence_type: type,
          licence_number: number,
          source_url: source.trim(),
          checked_on: checkedOn.trim(),
          expires_on: expiresOn.trim(),
          notes,
        });
        onSaved('Check added.');
      }}
    >
      <Text variant="label" color="inkMuted">
        Record what the regulator's own register says. Checks can't be edited afterwards, so to correct one, add another.
      </Text>
      <ChoiceRow label="Regulator" options={REGULATORS.map(r => ({ value: r, label: r }))} value={regulator} onChange={setRegulator} />
      <ChoiceRow label="Result" options={CHECK_STATUSES} value={status} onChange={setStatus} />
      <Input label="Link to the register" value={source} onChangeText={setSource} placeholder="https://" autoCapitalize="none" autoCorrect={false} keyboardType="url" />
      <Input label="Date you checked it" value={checkedOn} onChangeText={setCheckedOn} placeholder="YYYY-MM-DD" />
      <Input label="Licence type" value={type} onChangeText={setType} hint="Optional" />
      <Input label="Licence number" value={number} onChangeText={setNumber} hint="Optional" />
      <Input label="Expiry date" value={expiresOn} onChangeText={setExpiresOn} placeholder="YYYY-MM-DD" hint="Optional. The listing is hidden after this date." />
      <Input label="Private notes" value={notes} onChangeText={setNotes} multiline hint="Optional. Never shown to users." />
    </FormSheet>
  );
}

function ProductCard({ product, provider, rate, checks, listed, onEdit, onRate, onStatus }) {
  const blockers = listed ? [] : listingBlockers({ provider, product, rate, checks });
  return (
    <Card style={{ gap: space.md }}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: space.sm }}>
        <View style={{ flex: 1, minWidth: 0, gap: space.xxs }}>
          <Text variant="bodyStrong" family="bold">{product.name}</Text>
          <Text variant="caption" color="inkMuted">{labelOf(CATEGORIES, product.category)}</Text>
        </View>
        <Badge label={listed ? 'Showing in app' : 'Hidden'} tone={listed ? 'positive' : 'warning'} />
      </View>

      <View style={{ gap: space.xxs }}>
        <Text variant="bodyStrong" tabular>{describeRate(rate)}</Text>
        {rate ? <Text variant="caption" color="inkMuted">{`Checked ${shortDate(rate.checked_at)} on ${hostOf(rate.source_url)}`}</Text> : null}
      </View>

      {blockers.length ? (
        <View style={{ gap: space.xxs }}>
          <Text variant="label">Why it's hidden</Text>
          {blockers.map(blocker => <Text key={blocker} variant="label" family="regular" color="inkMuted">{`• ${blocker}`}</Text>)}
        </View>
      ) : null}

      <SegmentedControl options={STATUS_OPTIONS} value={product.status} onChange={onStatus} />
      <View style={{ flexDirection: 'row', gap: space.sm }}>
        <View style={{ flex: 1 }}><Button full title="Set rate" variant="secondary" onPress={onRate} /></View>
        <View style={{ flex: 1 }}><Button full title="Edit" variant="ghost" onPress={onEdit} /></View>
      </View>
    </Card>
  );
}

function CheckRow({ check, counts, last }) {
  const { c } = useTheme();
  const current = counts && isCurrentLicence(check);
  const expired = counts && check.status === 'verified' && !current;
  const details = [check.licence_type, check.licence_number].filter(Boolean).join(' · ');
  return (
    <View style={{ padding: space.lg, gap: space.xxs, borderBottomWidth: last ? 0 : 1, borderBottomColor: c.line }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.sm }}>
        <Text variant="bodyStrong" family="bold">{check.regulator}</Text>
        <Badge
          label={expired ? 'Expired' : labelOf(CHECK_STATUSES, check.status)}
          tone={current ? 'positive' : !counts ? 'neutral' : 'negative'}
        />
      </View>
      {details ? <Text variant="label" family="regular">{details}</Text> : null}
      <Text variant="caption" color="inkMuted">{`Checked ${shortDate(check.checked_at)} on ${hostOf(check.source_url)}`}</Text>
      {check.expires_at ? <Text variant="caption" color="inkMuted">{`Expires ${shortDate(check.expires_at)}`}</Text> : null}
      {check.notes ? <Text variant="caption" color="inkMuted">{check.notes}</Text> : null}
      {!counts ? <Text variant="caption" color="inkSubtle">Replaced by a newer check</Text> : null}
    </View>
  );
}

export default function CatalogAdminScreen({ onBack }) {
  const { c } = useTheme();
  const toast = useToast();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedId, setSelectedId] = useState(null);
  const [form, setForm] = useState(null);

  const load = useCallback(async () => {
    try {
      setData(await catalogAction('list'));
      setError(null);
    } catch (err) {
      setError(err);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function refresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  async function saved(message, providerId) {
    setForm(null);
    if (providerId) setSelectedId(providerId);
    toast.show(message, { tone: 'success' });
    await load();
  }

  async function changeStatus(action, id, status) {
    try {
      await catalogAction(action, { id, status });
      await load();
    } catch (err) {
      toast.show(err.message, { tone: 'error' });
    }
  }

  const provider = data?.providers.find(p => p.id === selectedId);
  const checksFor = id => data.checks.filter(check => check.provider_id === id);
  const rateFor = id => data.rates.find(rate => rate.product_id === id);
  const checks = provider ? checksFor(provider.id) : [];
  const latest = latestChecks(checks);
  const products = provider ? data.products.filter(product => product.provider_id === provider.id) : [];
  const refreshControl = <RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={c.accent} />;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.canvas }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.xs, paddingHorizontal: space.xs }}>
        <IconButton icon="arrow-back" label="Back" onPress={provider ? () => setSelectedId(null) : onBack} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text variant="bodyStrong" family="bold" numberOfLines={1} accessibilityRole="header">
            {provider ? provider.name : 'Compare catalogue'}
          </Text>
          {data && !provider ? (
            <Text variant="caption" color="inkMuted">{`${data.listed.length} of ${data.products.length} products showing in the app`}</Text>
          ) : null}
        </View>
      </View>

      {!data && !error ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={c.accent} accessibilityLabel="Loading" />
        </View>
      ) : !data ? (
        <EmptyState
          icon={error.code === 'forbidden' ? 'lock-closed-outline' : 'cloud-offline-outline'}
          title={error.code === 'forbidden' ? 'Admin access needed' : "Couldn't load the catalogue"}
          body={error.message}
          action={error.code === 'forbidden' ? null : <Button title="Try again" variant="secondary" onPress={load} />}
        />
      ) : provider ? (
        <ScrollView
          refreshControl={refreshControl}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ padding: space.xl, paddingTop: space.sm, gap: space.lg }}
        >
          <Card style={{ gap: space.md }}>
            <View style={{ gap: space.xxs }}>
              <Text variant="label" family="regular" color="inkMuted">{hostOf(provider.website_url)}</Text>
              <Text variant="caption" color="inkMuted">
                {currentRegulators(checks).length ? `Current licences: ${currentRegulators(checks).join(', ')}` : 'No current licence on file'}
              </Text>
            </View>
            <SegmentedControl
              options={STATUS_OPTIONS}
              value={provider.status}
              onChange={status => changeStatus('set_provider_status', provider.id, status)}
            />
            <Button full title="Edit provider" variant="ghost" onPress={() => setForm({ type: 'provider', provider })} />
          </Card>

          <View style={{ gap: space.sm }}>
            <SectionHeader title="Licence checks" actionLabel="Add check" onAction={() => setForm({ type: 'check' })} />
            {checks.length ? (
              <Card padded={false} style={{ overflow: 'hidden' }}>
                {checks.map((check, i) => (
                  <CheckRow key={check.id} check={check} counts={latest[check.regulator] === check} last={i === checks.length - 1} />
                ))}
              </Card>
            ) : (
              <Text variant="label" family="regular" color="inkMuted">
                No checks yet. Nothing from this provider can show in the app until one is verified.
              </Text>
            )}
          </View>

          <View style={{ gap: space.sm }}>
            <SectionHeader title="Products" actionLabel="Add product" onAction={() => setForm({ type: 'product' })} />
            {products.length ? products.map(product => (
              <ProductCard
                key={product.id}
                product={product}
                provider={provider}
                rate={rateFor(product.id)}
                checks={checks}
                listed={data.listed.includes(product.id)}
                onEdit={() => setForm({ type: 'product', product })}
                onRate={() => setForm({ type: 'rate', product })}
                onStatus={status => changeStatus('set_product_status', product.id, status)}
              />
            )) : <Text variant="label" family="regular" color="inkMuted">No products yet.</Text>}
          </View>
        </ScrollView>
      ) : (
        <ScrollView
          refreshControl={refreshControl}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ padding: space.xl, paddingTop: space.sm, gap: space.lg }}
        >
          <Button full title="Add provider" icon="add" onPress={() => setForm({ type: 'provider' })} />
          {data.providers.length ? (
            <Card padded={false} style={{ overflow: 'hidden' }}>
              {data.providers.map((p, i) => {
                const held = currentRegulators(checksFor(p.id));
                return (
                  <ListRow
                    key={p.id}
                    title={p.name}
                    subtitle={held.length ? held.join(', ') : 'No current licence'}
                    value={<Badge label={STATUS_LABEL[p.status]} tone={STATUS_TONE[p.status]} />}
                    chevron
                    divider={i < data.providers.length - 1}
                    onPress={() => setSelectedId(p.id)}
                  />
                );
              })}
            </Card>
          ) : (
            <EmptyState
              icon="business-outline"
              title="No providers yet"
              body="Add one, record its licence check and rate, then publish it."
            />
          )}
          <Divider />
          <Text variant="caption" color="inkMuted">
            A product shows in the app only when it and its provider are published, it has a sourced rate, and the provider has a current licence from the right regulator.
          </Text>
        </ScrollView>
      )}

      {form?.type === 'provider' ? <ProviderForm provider={form.provider} onClose={() => setForm(null)} onSaved={saved} /> : null}
      {form?.type === 'product' ? <ProductForm product={form.product} providerId={provider?.id} onClose={() => setForm(null)} onSaved={saved} /> : null}
      {form?.type === 'rate' ? <RateForm product={form.product} rate={rateFor(form.product.id)} onClose={() => setForm(null)} onSaved={saved} /> : null}
      {form?.type === 'check' ? <CheckForm provider={provider} onClose={() => setForm(null)} onSaved={saved} /> : null}
    </SafeAreaView>
  );
}
