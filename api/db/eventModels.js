const mongoose = require('mongoose');

const { Schema } = mongoose;

/* Event Stamps */
const EventStampSchema = new Schema(
  {
    session_id: { type: String, required: true },
    stand: { type: String, enum: ['A', 'B'], required: true },
    source: { type: String, enum: ['qr', 'qcm'], required: true },
    issued_at: { type: Date, required: true, default: () => new Date() },
    expires_at: { type: Date, required: true },
    nonce: { type: String, required: true },
  },
  { collection: 'event_stamps', timestamps: true },
);

EventStampSchema.index({ session_id: 1, stand: 1 }, { unique: true });
EventStampSchema.index({ expires_at: 1 }, { expireAfterSeconds: 0 });

/* Event Leads */
const EventLeadSchema = new Schema(
  {
    email: { type: String, required: true },
    // Nouveau pré‑formulaire (non requis dans l'ancien flux)
    first_name: { type: String, default: '' },
    last_name: { type: String, default: '' },
    use_case: { type: String, default: '' },
    qcm_gate_passed: { type: Boolean, default: false },

    // Champs historiques (rendus optionnels)
    company: { type: String, default: '' },
    domain: { type: String, default: '' },
    seats_requested: { type: Number, default: 1 },

    consent_transactional: { type: Boolean, required: true },
    consent_marketing: { type: Boolean, required: true },
    stamps_completed: { type: Boolean, default: false },
    activation_token_hash: { type: String },
    activation_url: { type: String },
    voucher_id: { type: String, default: null },
    status: { type: String, enum: ['pending', 'sent', 'activated'], default: 'pending' },
    expires_at: { type: Date, required: true },
    validation_code_hash: { type: String, default: null },
    validation_sent_at: { type: Date, default: null },
    validated: { type: Boolean, default: false },
    code_issue_count: { type: Number, default: 0 },
    code_issue_date: { type: Date, default: null },
  },
  { collection: 'event_leads', timestamps: true },
);

EventLeadSchema.index({ expires_at: 1 }, { expireAfterSeconds: 0 });
// Unique among activated leads only (partial index)
EventLeadSchema.index(
  { email: 1 },
  { unique: true, partialFilterExpression: { status: 'activated' } },
);

/* Event Vouchers */
const EventVoucherSchema = new Schema(
  {
    voucher_id: { type: String, required: true, unique: true },
    org_id: { type: String, required: true },
    allowed_domains: { type: [String], required: true },
    max_seats: { type: Number, required: true },
    redemptions_count: { type: Number, default: 0 },
    models_allowlist: { type: [String], default: [] },
    org_daily_token_cap: { type: Number },
    expires_at: { type: Date },
    status: { type: String, enum: ['active', 'frozen', 'expired'], default: 'active' },
  },
  { collection: 'event_vouchers', timestamps: true },
);

EventVoucherSchema.index({ allowed_domains: 1 });
EventVoucherSchema.index({ expires_at: 1 });

/* Event Seats */
const EventSeatSchema = new Schema(
  {
    seat_id: { type: String, required: true, unique: true },
    voucher_id: { type: String, required: true, index: true },
    user_id: { type: String, default: null },
    email: { type: String, required: true },
    activated_at: { type: Date, default: null },
    status: { type: String, enum: ['active', 'revoked', 'expired'], default: 'active' },
    user_daily_caps: {
      msgs: { type: Number, required: true },
      tokens: { type: Number, default: null },
    },
    litellm_key_id: { type: String, default: null },
  },
  { collection: 'event_seats', timestamps: true },
);

// Unique active seat per voucher+email (partial index for active status)
EventSeatSchema.index(
  { voucher_id: 1, email: 1 },
  { unique: true, partialFilterExpression: { status: 'active' } },
);

/* Redemptions Log */
const RedemptionLogSchema = new Schema(
  {
    voucher_id: { type: String, required: true, index: true },
    user_id: { type: String, default: null },
    email: { type: String, default: null },
    ts: { type: Date, required: true, default: () => new Date() },
    ip: { type: String },
    result: {
      type: String,
      enum: ['ok', 'duplicate', 'domain_blocked', 'cap_reached', 'expired', 'frozen'],
      required: true,
    },
  },
  { collection: 'redemptions_log', timestamps: true },
);

RedemptionLogSchema.index({ voucher_id: 1, ts: -1 });

/* Usage Rollups Daily */
const UsageRollupDailySchema = new Schema(
  {
    org_id: { type: String, required: true },
    date: { type: Date, required: true },
    tokens: { type: Number, required: true, default: 0 },
    messages: { type: Number, required: true, default: 0 },
    by_model: {
      type: Map,
      of: new Schema(
        {
          tokens: { type: Number, default: 0 },
          messages: { type: Number, default: 0 },
        },
        { _id: false },
      ),
      default: {},
    },
  },
  { collection: 'usage_rollups_daily', timestamps: true },
);

UsageRollupDailySchema.index({ org_id: 1, date: 1 }, { unique: true });

const EventStamp =
  mongoose.models.EventStamp || mongoose.model('EventStamp', EventStampSchema, 'event_stamps');
const EventLead =
  mongoose.models.EventLead || mongoose.model('EventLead', EventLeadSchema, 'event_leads');
const EventVoucher =
  mongoose.models.EventVoucher || mongoose.model('EventVoucher', EventVoucherSchema, 'event_vouchers');
const EventSeat =
  mongoose.models.EventSeat || mongoose.model('EventSeat', EventSeatSchema, 'event_seats');
const RedemptionLog =
  mongoose.models.RedemptionLog ||
  mongoose.model('RedemptionLog', RedemptionLogSchema, 'redemptions_log');
const UsageRollupDaily =
  mongoose.models.UsageRollupDaily ||
  mongoose.model('UsageRollupDaily', UsageRollupDailySchema, 'usage_rollups_daily');

/* QCM Attempts */
const QcmAttemptSchema = new Schema(
  {
    session_id: { type: String, required: true, unique: true },
    attempts_count: { type: Number, required: true, default: 0 },
    last_attempt_at: { type: Date, default: null },
    cooldown_until: { type: Date, default: null },
    passed: { type: Boolean, default: false },
  },
  { collection: 'event_qcm_attempts', timestamps: true },
);

QcmAttemptSchema.index({ session_id: 1 }, { unique: true });

const QcmAttempt =
  mongoose.models.QcmAttempt ||
  mongoose.model('QcmAttempt', QcmAttemptSchema, 'event_qcm_attempts');

module.exports = {
  EventStamp,
  EventLead,
  EventVoucher,
  EventSeat,
  RedemptionLog,
  UsageRollupDaily,
  QcmAttempt,
};

/* Event Metrics */
const EventMetricSchema = new Schema(
  {
    type: {
      type: String,
      enum: [
        'stamp_scanned',
        'qcm_attempt',
        'lead_created',
        'voucher_issued',
        'seat_activated',
        'seat_revoked',
        'usage_tick',
        'budget_hit_user',
        'budget_hit_org',
      ],
      required: true,
      index: true,
    },
    ts: { type: Date, required: true, default: () => new Date(), index: true },
    meta: { type: Object, default: {} },
  },
  { collection: 'event_metrics', timestamps: true },
);

const EventMetric =
  mongoose.models.EventMetric || mongoose.model('EventMetric', EventMetricSchema, 'event_metrics');

module.exports.EventMetric = EventMetric;


