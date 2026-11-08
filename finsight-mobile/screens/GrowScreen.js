import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator, Image, Linking, Modal, Pressable, RefreshControl, ScrollView, StatusBar, View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { radius, space } from '../constants/tokens';
import {
  Badge, Button, Card, Chip, EmptyState, Gradient, Icon, IconButton, Input, SegmentedControl, Sheet, Text,
  tapFeedback, useTheme, useToast,
} from '../components/ui';
import InvestmentsScreen from './InvestmentsScreen';
import { fetchInflation, fetchListings } from '../services/compareCatalog';
import { describeRate, hostOf, shortDate } from '../services/catalogRules';
import {
  amountRange, annualNote, filterListings, headlineRate, inflationCheck, isStale, MAX_COMPARE, regulatorsIn,
  sortListings, sortOptions, TABS, termRange, TERMS, toggleCompare,
} from '../services/compareRules';
import { parseAmount } from '../services/format';

const NO_FILTERS = { amount: null, term: null, regulator: null };
const NOT_STATED = 'Not stated';

const countFilters = filters => Object.values(filters).filter(Boolean).length;
const regulatorNames = listing => listing.badges.map(b => b.regulator).join(', ');

function ProviderLogo({ listing, size = 46 }) {
  const { c } = useTheme();
  const [failed, setFailed] = useState(false);
  const rounded = Math.round(size * 0.3);
  if (listing.logo_url && !failed) {
    return (
      <Image
        source={{ uri: listing.logo_url }}
        onError={() => setFailed(true)}
        accessibilityIgnoresInvertColors
        style={{ width: size, height: size, borderRadius: rounded, backgroundColor: c.sunken }}
      />
    );
  }
  return (
    <View style={{
      width: size, height: size, borderRadius: rounded, alignItems: 'center', justifyContent: 'center', backgroundColor: c.accentSoft,
    }}>
      <Text variant="heading" family="bold" color="onAccentSoft">{listing.provider_name.charAt(0).toUpperCase()}</Text>
    </View>
  );
}

function LicenceBadges({ listing }) {
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.xs }}>
      {listing.badges.map(b => <Badge key={b.regulator} label={`${b.regulator} verified`} tone="positive" icon="shield-checkmark-outline" />)}
    </View>
  );
}

function Freshness({ listing }) {
  const stale = isStale(listing.rate_checked_at);
  return (
    <Text variant="caption" family={stale ? 'semibold' : 'regular'} color={stale ? 'warning' : 'inkSubtle'}>
      {`${stale ? 'May be out of date. Last checked' : 'Last checked'} ${shortDate(listing.rate_checked_at)}`}
    </Text>
  );
}

const INFLATION_ICONS = { positive: 'trending-up-outline', warning: 'trending-down-outline', neutral: 'remove-outline' };

function ListingCard({ listing, inflation, selected, onDetails, onCompare }) {
  const details = [amountRange(listing), termRange(listing)].filter(Boolean).join(' · ');
  const check = inflationCheck(listing, inflation);
  return (
    <Card style={{ gap: space.md }}>
      {/* Only this part opens the details, so screen readers can reach the buttons below. */}
      <Pressable
        onPress={() => { tapFeedback(); onDetails(); }}
        accessibilityRole="button"
        accessibilityLabel={`${listing.provider_name}, ${headlineRate(listing)}. View details`}
        style={{ gap: space.md }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
          <ProviderLogo listing={listing} />
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text variant="bodyStrong" family="bold" numberOfLines={1}>{listing.provider_name}</Text>
            <Text variant="caption" color="inkMuted" numberOfLines={1}>{listing.product_name}</Text>
          </View>
          <Icon name="chevron-forward" size={18} color="inkSubtle" />
        </View>

        <View style={{ gap: space.xxs }}>
          {/* A loan rate is a cost, not a highlight; what savings earn is shown in green. */}
          <Text variant="heading" family="bold" color={listing.category === 'loan' ? 'ink' : 'positive'} tabular>{headlineRate(listing)}</Text>
          {annualNote(listing) ? <Text variant="caption" color="inkMuted">{annualNote(listing)}</Text> : null}
          {details ? <Text variant="label" family="regular" color="inkMuted">{details}</Text> : null}
        </View>

        {check ? <Badge label={check.label} tone={check.tone} icon={INFLATION_ICONS[check.tone]} /> : null}
        <LicenceBadges listing={listing} />
        <View style={{ gap: space.xxs }}>
          <Freshness listing={listing} />
          {listing.is_referral ? <Text variant="caption" color="inkSubtle">FinSight may earn from this link</Text> : null}
        </View>
      </Pressable>

      {/* One action on the card: tap it for details (where "Go to provider" is), or add it to compare. */}
      <View style={{ flexDirection: 'row', justifyContent: 'flex-end' }}>
        <Chip label={selected ? 'Comparing' : 'Compare'} icon={selected ? 'checkmark' : 'add'} selected={selected} onPress={onCompare} />
      </View>
    </Card>
  );
}

function DetailRow({ label, value }) {
  if (!value) return null;
  return (
    <View style={{ gap: space.xxs }}>
      <Text variant="caption" color="inkMuted">{label}</Text>
      <Text variant="body">{value}</Text>
    </View>
  );
}

function LinkRow({ icon, label, url }) {
  const toast = useToast();
  return (
    <Pressable
      onPress={() => {
        tapFeedback();
        Linking.openURL(url).catch(() => toast.show("Couldn't open that website.", { tone: 'error' }));
      }}
      accessibilityRole="link"
      accessibilityLabel={label}
      style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm, minHeight: 44 }}
    >
      <Icon name={icon} size={18} color="accent" />
      <Text variant="label" color="accent" style={{ flex: 1 }}>{label}</Text>
      <Icon name="open-outline" size={16} color="inkSubtle" />
    </Pressable>
  );
}

function DetailSheet({ listing, inflation, onClose, onLeave }) {
  const check = inflationCheck(listing, inflation);
  return (
    <Sheet
      visible
      onClose={onClose}
      title={listing.provider_name}
      footer={(
        <>
          <Button full title="Go to provider" icon="open-outline" onPress={onLeave} />
          <Button full title="Close" variant="ghost" onPress={onClose} />
        </>
      )}
    >
      <ScrollView style={{ flexShrink: 1 }} contentContainerStyle={{ gap: space.md }}>
        <DetailRow label="Product" value={listing.product_name} />
        <DetailRow label="Rate" value={describeRate(listing)} />
        <DetailRow label="Per year" value={annualNote(listing)} />
        {check ? <DetailRow label="Against inflation" value={`${check.label}. ${check.detail}`} /> : null}
        <DetailRow label="Amount" value={amountRange(listing)} />
        <DetailRow label="Term" value={termRange(listing)} />
        <DetailRow label="Fees" value={listing.fees} />
        <DetailRow label="Key terms" value={listing.key_terms.join('\n')} />
        <Freshness listing={listing} />
        <LinkRow icon="document-text-outline" label={`Rate source: ${hostOf(listing.rate_source_url)}`} url={listing.rate_source_url} />
        {check ? <LinkRow icon="stats-chart-outline" label={`Inflation source: ${hostOf(inflation.source_url)}`} url={inflation.source_url} /> : null}
        {listing.badges.map(b => (
          <View key={b.regulator}>
            <LinkRow icon="shield-checkmark-outline" label={`${b.regulator} register: ${hostOf(b.source_url)}`} url={b.source_url} />
            <Text variant="caption" color="inkMuted">
              {`Checked ${shortDate(b.checked_at)}${b.licence_number ? ` · Licence ${b.licence_number}` : ''}`}
            </Text>
          </View>
        ))}
        {listing.is_referral ? <Text variant="caption" color="inkMuted">FinSight may earn from this link. It doesn't affect the order of this list.</Text> : null}
      </ScrollView>
    </Sheet>
  );
}

function CompareRow({ label, values }) {
  const { c } = useTheme();
  return (
    <View style={{ paddingVertical: space.md, gap: space.xs, borderTopWidth: 1, borderTopColor: c.line }}>
      <Text variant="caption" family="semibold" color="inkMuted" accessibilityRole="header">{label}</Text>
      <View style={{ flexDirection: 'row', gap: space.sm }}>
        {values.map((value, i) => (
          <View key={i} style={{ flex: 1, minWidth: 0 }}>
            <Text variant="label" family="regular" color={value === NOT_STATED ? 'inkSubtle' : 'ink'}>{value}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function CompareModal({ listings, inflation, onClose, onRemove, onLeave }) {
  const { c } = useTheme();
  const values = read => listings.map(l => read(l) || NOT_STATED);
  const hasInflation = listings.some(l => inflationCheck(l, inflation));
  return (
    <Modal visible animationType="slide" presentationStyle="fullScreen" onRequestClose={onClose}>
      <SafeAreaView style={{ flex: 1, backgroundColor: c.canvas }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.xs, paddingHorizontal: space.xs }}>
          <IconButton icon="arrow-back" label="Back to the list" onPress={onClose} />
          <Text variant="bodyStrong" family="bold" accessibilityRole="header">Compare</Text>
        </View>
        <ScrollView contentContainerStyle={{ padding: space.lg, paddingBottom: space.huge }}>
          <View style={{ flexDirection: 'row', gap: space.sm, marginBottom: space.md }}>
            {listings.map(l => (
              <View key={l.product_id} style={{ flex: 1, minWidth: 0, gap: space.xs }}>
                <ProviderLogo listing={l} size={40} />
                <Text variant="label" family="bold">{l.provider_name}</Text>
                <Text variant="caption" color="inkMuted">{l.product_name}</Text>
                <Pressable onPress={() => onRemove(l.product_id)} accessibilityRole="button" accessibilityLabel={`Remove ${l.provider_name}`} hitSlop={8}>
                  <Text variant="caption" family="semibold" color="accent">Remove</Text>
                </Pressable>
              </View>
            ))}
          </View>
          <CompareRow label="Rate" values={values(describeRate)} />
          <CompareRow label="Per year" values={values(annualNote).map(v => (v === NOT_STATED ? 'As above' : v))} />
          {hasInflation ? <CompareRow label="Against inflation" values={values(l => inflationCheck(l, inflation)?.label)} /> : null}
          <CompareRow label="Amount" values={values(amountRange)} />
          <CompareRow label="Term" values={values(termRange)} />
          <CompareRow label="Fees" values={values(l => l.fees)} />
          <CompareRow label="Key terms" values={values(l => l.key_terms.join('\n'))} />
          <CompareRow label="Licence checked" values={values(regulatorNames)} />
          <CompareRow label="Rate last checked" values={values(l => shortDate(l.rate_checked_at))} />
          <View style={{ flexDirection: 'row', gap: space.sm, marginTop: space.md }}>
            {listings.map(l => (
              <View key={l.product_id} style={{ flex: 1, minWidth: 0, gap: space.xs }}>
                <Pressable
                  onPress={() => { tapFeedback(); onLeave(l); }}
                  accessibilityRole="button"
                  accessibilityLabel={`Go to ${l.provider_name}`}
                  style={{
                    minHeight: 44, alignItems: 'center', justifyContent: 'center', paddingHorizontal: space.xs,
                    borderRadius: radius.md, borderWidth: 1.5, borderColor: c.accent,
                  }}
                >
                  <Text variant="label" family="bold" color="accent">Go</Text>
                </Pressable>
                {l.is_referral ? <Text variant="caption" color="inkSubtle">FinSight may earn from this link</Text> : null}
              </View>
            ))}
          </View>
          <Text variant="caption" color="inkMuted" style={{ marginTop: space.lg }}>
            These are the rates each provider publishes, not an offer to you. What you get may differ, so check with the provider.
          </Text>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

function FilterSheet({ listings, category, filters, onApply, onClose }) {
  const [amountText, setAmountText] = useState(filters.amount ? String(filters.amount) : '');
  const [term, setTerm] = useState(filters.term);
  const [regulator, setRegulator] = useState(filters.regulator);
  const amount = parseAmount(amountText);
  const draft = { amount, term, regulator };
  const count = filterListings(listings, draft).length;
  const regulators = regulatorsIn(listings);
  const showTerm = category !== 'fund';
  return (
    <Sheet
      visible
      onClose={onClose}
      title="Filter"
      footer={(
        <>
          <Button full title={count === 1 ? 'Show 1 result' : `Show ${count} results`} onPress={() => onApply(draft)} />
          <Button full title="Clear filters" variant="ghost" onPress={() => onApply(NO_FILTERS)} />
        </>
      )}
    >
      <ScrollView style={{ flexShrink: 1 }} keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: space.lg }}>
        <Input
          label={category === 'loan' ? 'How much do you want to borrow?' : 'How much do you want to put in?'}
          value={amountText}
          onChangeText={setAmountText}
          prefix="₦"
          keyboardType="number-pad"
          error={amountText.trim() && !amount ? 'Enter an amount in naira.' : undefined}
        />
        {showTerm ? (
          <View style={{ gap: space.xs }}>
            <Text variant="label">Term</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
              {TERMS.map(t => (
                <Chip key={t.value} label={t.label} selected={term === t.value} onPress={() => setTerm(term === t.value ? null : t.value)} />
              ))}
            </View>
          </View>
        ) : null}
        {regulators.length > 1 ? (
          <View style={{ gap: space.xs }}>
            <Text variant="label">Licensed by</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
              {regulators.map(r => (
                <Chip key={r} label={r} selected={regulator === r} onPress={() => setRegulator(regulator === r ? null : r)} />
              ))}
            </View>
          </View>
        ) : null}
      </ScrollView>
    </Sheet>
  );
}

function LeaveSheet({ listing, onClose }) {
  const { c } = useTheme();
  const toast = useToast();
  function open() {
    onClose();
    Linking.openURL(listing.link_url).catch(() => toast.show("Couldn't open that website.", { tone: 'error' }));
  }
  return (
    <Sheet
      visible
      onClose={onClose}
      title={`Open ${listing.provider_name}?`}
      footer={(
        <>
          <Button full title="Open website" icon="open-outline" onPress={open} />
          <Button full title="Stay here" variant="ghost" onPress={onClose} />
        </>
      )}
    >
      <View style={{ backgroundColor: c.sunken, borderRadius: radius.md, padding: space.md, gap: space.sm }}>
        <Text variant="label" family="regular" color="inkMuted">
          You're leaving FinSight for a website we don't run. Read the provider's terms before you borrow or send money.
        </Text>
        {listing.is_referral ? (
          <Text variant="label" family="regular" color="inkMuted">FinSight may earn if you use this link. It doesn't affect the order of the list.</Text>
        ) : null}
      </View>
    </Sheet>
  );
}

function CompareList({ listings, inflation, refreshing, onRefresh }) {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const [category, setCategory] = useState('savings');
  const [sort, setSort] = useState('rate');
  const [filters, setFilters] = useState(NO_FILTERS);
  const [selectedByTab, setSelectedByTab] = useState({});
  const [details, setDetails] = useState(null);
  const [leaving, setLeaving] = useState(null);
  const [filtering, setFiltering] = useState(false);
  const [comparing, setComparing] = useState(false);

  const inTab = useMemo(() => listings.filter(l => l.category === category), [listings, category]);
  const shown = useMemo(
    () => sortListings(filterListings(inTab, filters), category, sort),
    [inTab, filters, category, sort],
  );
  // A provider that has gone since it was picked drops out of the comparison.
  const selected = (selectedByTab[category] || []).filter(id => inTab.some(l => l.product_id === id));
  const compared = selected.map(id => inTab.find(l => l.product_id === id));
  const filterCount = countFilters(filters);

  function switchTab(next) {
    tapFeedback();
    setCategory(next);
    setSort('rate');
    setFilters(NO_FILTERS);
  }

  function toggle(id) {
    const result = toggleCompare(selected, id);
    if (result.full) toast.show(`You can compare up to ${MAX_COMPARE} at a time.`);
    setSelectedByTab(current => ({ ...current, [category]: result.selected }));
  }

  function removeFromCompare(id) {
    const next = selected.filter(s => s !== id);
    setSelectedByTab(current => ({ ...current, [category]: next }));
    if (next.length < 2) setComparing(false);
  }

  const tabLabel = TABS.find(t => t.value === category).label.toLowerCase();

  return (
    <View style={{ flex: 1, backgroundColor: c.canvas }}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={c.accent} />}
        contentContainerStyle={{ paddingBottom: selected.length ? 150 : space.xxxl }}
      >
        <Gradient style={{ paddingTop: insets.top + space.md, paddingHorizontal: space.xl, paddingBottom: space.lg, gap: space.xs, borderBottomLeftRadius: 28, borderBottomRightRadius: 28, overflow: 'hidden' }}>
          <Text variant="title" family="bold" color="#FFFFFF" accessibilityRole="header">Compare & Grow</Text>
          <Text variant="label" color="#FFFFFF">Providers whose licence we've checked</Text>
        </Gradient>
        <View style={{ margin: space.xl, marginTop: space.lg }}>
          <SegmentedControl value={category} onChange={switchTab} options={TABS} />
        </View>

        <View style={{ paddingHorizontal: space.xl, gap: space.md }}>
          {inTab.length ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.sm }}>
              <Chip
                label={filterCount ? `Filter (${filterCount})` : 'Filter'}
                icon="options-outline"
                selected={filterCount > 0}
                onPress={() => setFiltering(true)}
              />
              {sortOptions(category).map(o => (
                <Chip key={o.value} label={o.label} selected={sort === o.value} onPress={() => setSort(o.value)} />
              ))}
            </ScrollView>
          ) : null}

          {!inTab.length ? (
            <EmptyState
              icon="shield-checkmark-outline"
              title={`No ${tabLabel} listed yet`}
              body="We only list a provider after checking its licence and rates. More are on the way."
            />
          ) : !shown.length ? (
            <EmptyState
              icon="filter-outline"
              title="Nothing matches those filters"
              action={<Button title="Clear filters" variant="secondary" onPress={() => setFilters(NO_FILTERS)} />}
            />
          ) : shown.map(listing => (
            <ListingCard
              key={listing.product_id}
              listing={listing}
              inflation={inflation}
              selected={selected.includes(listing.product_id)}
              onDetails={() => setDetails(listing)}
              onCompare={() => toggle(listing.product_id)}
            />
          ))}

          {inTab.length ? (
            <Text variant="caption" color="inkMuted">
              The order comes only from the sort you pick, and payment never changes it. These are the rates providers publish, not advice or an offer, so check the terms before you decide.
            </Text>
          ) : null}
        </View>
      </ScrollView>

      {selected.length ? (
        <View style={{
          // The extra space at the bottom clears the add button, which rises above the tab bar.
          position: 'absolute', left: 0, right: 0, bottom: 0, padding: space.lg, paddingTop: space.md, paddingBottom: 36,
          flexDirection: 'row', alignItems: 'center', gap: space.md, backgroundColor: c.surface,
          borderTopWidth: 1, borderTopColor: c.line,
        }}>
          <Text variant="label" style={{ flex: 1 }} accessibilityLiveRegion="polite">
            {selected.length === 1 ? 'Pick at least one more to compare' : `${selected.length} selected`}
          </Text>
          <Button title="Compare" disabled={selected.length < 2} onPress={() => setComparing(true)} />
        </View>
      ) : null}

      {filtering ? (
        <FilterSheet
          listings={inTab}
          category={category}
          filters={filters}
          onApply={next => { setFilters(next); setFiltering(false); }}
          onClose={() => setFiltering(false)}
        />
      ) : null}
      {details ? (
        <DetailSheet
          listing={details}
          inflation={inflation}
          onClose={() => setDetails(null)}
          onLeave={() => { setLeaving(details); setDetails(null); }}
        />
      ) : null}
      {comparing ? (
        <CompareModal
          listings={compared}
          inflation={inflation}
          onClose={() => setComparing(false)}
          onRemove={removeFromCompare}
          onLeave={listing => { setComparing(false); setLeaving(listing); }}
        />
      ) : null}
      {leaving ? <LeaveSheet listing={leaving} onClose={() => setLeaving(null)} /> : null}
    </View>
  );
}

export default function GrowScreen() {
  const { c } = useTheme();
  const toast = useToast();
  const [listings, setListings] = useState(null);
  const [inflation, setInflation] = useState(null);
  const [failed, setFailed] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async ({ announce = false } = {}) => {
    try {
      const [nextListings, nextInflation] = await Promise.all([fetchListings(), fetchInflation()]);
      setListings(nextListings);
      setInflation(nextInflation);
      setFailed(false);
    } catch {
      setFailed(true);
      if (announce) toast.show("Couldn't refresh the list. Check your connection.", { tone: 'error' });
    }
  }, [toast]);

  // Reload on every visit, so a licence that's been revoked leaves the list soon after.
  useFocusEffect(useCallback(() => { load(); }, [load]));

  async function refresh() {
    setRefreshing(true);
    await load({ announce: true });
    setRefreshing(false);
  }

  if (listings === null) {
    return (
      <View style={{ flex: 1, backgroundColor: c.canvas, justifyContent: 'center' }}>
        {failed ? (
          <EmptyState
            icon="cloud-offline-outline"
            title="Couldn't load the list"
            body="Check your connection and try again."
            action={<Button title="Try again" variant="secondary" onPress={() => { setFailed(false); load(); }} />}
          />
        ) : <ActivityIndicator color={c.accent} accessibilityLabel="Loading" />}
      </View>
    );
  }

  // Until the first verified provider goes live, people keep the starting list.
  if (!listings.length) return <InvestmentsScreen />;

  return <CompareList listings={listings} inflation={inflation} refreshing={refreshing} onRefresh={refresh} />;
}
