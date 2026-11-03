import React, { useState } from 'react';
import { View } from 'react-native';
import { space } from '../constants/tokens';
import {
  Badge, Button, Card, CategoryTile, Chip, ConfirmSheet, EmptyState, IconButton, Input,
  ListRow, Money, ProgressBar, Screen, SectionHeader, SegmentedControl, Sheet, Skeleton, Text,
  useToast,
} from '../components/ui';

// Every shared component in one place, for reviewing the design system. All
// names and amounts here are made-up samples.
const SAMPLE_ROWS = [
  { cat: 'Food', title: 'Groceries', sub: 'Today', amount: -12400 },
  { cat: 'Transport', title: 'Ride home', sub: 'Today', amount: -3200 },
  { cat: 'Income', title: 'Salary', sub: 'Yesterday', amount: 450000 },
  { cat: 'Utilities', title: 'Electricity', sub: '28 Oct', amount: -15000 },
];

function Block({ title, children }) {
  return (
    <View style={{ gap: space.md }}>
      <SectionHeader title={title} />
      {children}
    </View>
  );
}

const Row = ({ children }) => (
  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, alignItems: 'center' }}>{children}</View>
);

export default function DesignGalleryScreen({ scheme, onToggleScheme, onClose }) {
  const toast = useToast();
  const [tab, setTab] = useState('savings');
  const [chip, setChip] = useState('best');
  const [amount, setAmount] = useState('');
  const [sheet, setSheet] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [loading, setLoading] = useState(false);

  const fakeLoad = () => { setLoading(true); setTimeout(() => setLoading(false), 1500); };

  return (
    <Screen>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Text variant="title" accessibilityRole="header">Design system</Text>
        <View style={{ flexDirection: 'row' }}>
          <IconButton
            icon={scheme === 'dark' ? 'sunny-outline' : 'moon-outline'}
            label={scheme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            onPress={onToggleScheme}
          />
          {onClose ? <IconButton icon="close" label="Close" onPress={onClose} /> : null}
        </View>
      </View>

      <Card>
        <Text variant="label" family="regular" color="inkMuted">Left to spend until payday</Text>
        <Money value={184500} variant="display" />
        <Text variant="label" family="regular" color="inkMuted" style={{ marginBottom: space.md }}>
          About ₦9,700 a day for 19 days
        </Text>
        <ProgressBar value={0.58} label="58% of this month's income spent" />
      </Card>

      <Block title="Type">
        <Text variant="display">Display</Text>
        <Text variant="title">Title text</Text>
        <Text variant="heading">Heading text</Text>
        <Text>Body text is for sentences. It stays easy to read in both light and dark mode.</Text>
        <Text variant="bodyStrong">Strong body text</Text>
        <Text variant="label">Label text</Text>
        <Text variant="caption" color="inkSubtle">Caption text, the smallest size we use</Text>
      </Block>

      <Block title="Money">
        <Card padded={false}>
          {SAMPLE_ROWS.map((row, i) => (
            <ListRow
              key={row.title}
              leading={<CategoryTile category={row.cat} />}
              title={row.title}
              subtitle={row.sub}
              value={<Money value={row.amount} tone="auto" showSign={row.amount > 0} />}
              divider={i < SAMPLE_ROWS.length - 1}
              onPress={() => toast.show(`Opened ${row.title}`)}
            />
          ))}
        </Card>
        <Row>
          <Money value={1111111} tone="inkMuted" />
          <Money value={8888888} tone="inkMuted" />
          <Money value={1250000} compact tone="inkMuted" />
          <Money value={null} tone="inkMuted" />
        </Row>
      </Block>

      <Block title="Buttons">
        <Button full title="Primary action" onPress={() => toast.show('Saved', { tone: 'success' })} />
        <Button full title="Secondary" variant="secondary" icon="add" onPress={() => toast.show('Could not save. Try again.', { tone: 'error' })} />
        <Button full title="Ghost" variant="ghost" onPress={() => {}} />
        <Button full title="Delete account data" variant="danger" onPress={() => setConfirm(true)} />
        <Button full title="Loading" loading={loading} onPress={fakeLoad} variant={loading ? 'primary' : 'secondary'} />
        <Button full title="Not available" disabled onPress={() => {}} />
      </Block>

      <Block title="Choices">
        <SegmentedControl
          value={tab}
          onChange={setTab}
          options={[
            { value: 'loans', label: 'Loans' },
            { value: 'savings', label: 'Savings' },
            { value: 'funds', label: 'Funds' },
            { value: 'fx', label: 'FX' },
          ]}
        />
        <Row>
          <Chip label="Best rate" selected={chip === 'best'} onPress={() => setChip('best')} />
          <Chip label="Licensed" selected={chip === 'licensed'} onPress={() => setChip('licensed')} />
          <Chip label="Filter" icon="options-outline" selected={chip === 'filter'} onPress={() => setChip('filter')} />
        </Row>
        <Row>
          <Badge label="CBN licensed" tone="accent" icon="shield-checkmark-outline" />
          <Badge label="On track" tone="positive" />
          <Badge label="Rate may be old" tone="warning" icon="time-outline" />
          <Badge label="Over budget" tone="negative" />
          <Badge label="Sponsored" />
        </Row>
      </Block>

      <Block title="Progress">
        <ProgressBar value={0.35} label="35%" />
        <ProgressBar value={0.82} tone="warning" label="82%" />
        <ProgressBar value={1} tone="negative" label="100%" />
      </Block>

      <Block title="Inputs">
        <Input
          label="Amount"
          prefix="₦"
          keyboardType="numeric"
          placeholder="5,000"
          value={amount}
          onChangeText={setAmount}
          hint="What you spent, in naira"
        />
        <Input label="Description" placeholder="Groceries" value="" onChangeText={() => {}} error="Enter a description" />
      </Block>

      <Block title="Sheets and messages">
        <Button full title="Open sheet" variant="secondary" onPress={() => setSheet(true)} />
      </Block>

      <Block title="Loading">
        <Card>
          <View style={{ gap: space.sm }}>
            <Skeleton width="40%" />
            <Skeleton width="70%" height={36} />
            <Skeleton width="55%" />
          </View>
        </Card>
      </Block>

      <Block title="Empty">
        <Card>
          <EmptyState
            icon="receipt-outline"
            title="Add your first transaction"
            body="Log what you spend, or import your bank alerts, and your figures will appear here."
            action={<Button title="Add transaction" variant="secondary" onPress={() => {}} />}
          />
        </Card>
      </Block>

      <Sheet
        visible={sheet}
        onClose={() => setSheet(false)}
        title="Add a savings goal"
        footer={<Button full title="Save goal" onPress={() => { setSheet(false); toast.show('Goal saved', { tone: 'success' }); }} />}
      >
        <View style={{ gap: space.md }}>
          <Text color="inkMuted">Sheets replace most popups. They slide up from the bottom, where your thumb already is.</Text>
          <Input label="Goal name" placeholder="New car" value="" onChangeText={() => {}} />
        </View>
      </Sheet>

      <ConfirmSheet
        visible={confirm}
        destructive
        title="Delete all your data?"
        body="This removes your transactions, budgets and goals from this phone. It can't be undone."
        confirmLabel="Delete everything"
        onConfirm={() => { setConfirm(false); toast.show('Nothing was deleted: this is a preview'); }}
        onCancel={() => setConfirm(false)}
      />
    </Screen>
  );
}
