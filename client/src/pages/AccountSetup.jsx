import { useEffect, useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Eye, EyeOff, KeyRound, ShieldCheck, UserRound } from 'lucide-react';
import { API_ORIGIN } from '../utils/apiConfig.js';

const BG = '#F7F4EE';
const SURFACE = '#FFFDF9';
const BORDER = '#E7D8C7';
const PRIMARY = '#6D2140';
const PRIMARY_DEEP = '#4A1730';
const INK = '#241512';
const MUTED = '#8A7A68';
const ERROR = '#A24A4A';
const ROLE_HOME = { admin: '/admin', staff: '/staff', officer: '/officer' };
const ROLE_LABEL = { admin: 'Administrator', staff: 'Staff', officer: 'Officer' };

const AccountSetup = () => {
    const navigate = useNavigate();
    const [profile, setProfile] = useState({ login_id: '', full_name: '', email: '', phone: '', role: '' });
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPasswords, setShowPasswords] = useState(false);
    const [error, setError] = useState('');
    const [loadingProfile, setLoadingProfile] = useState(true);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        const token = localStorage.getItem('token');
        axios.get(`${API_ORIGIN}/api/account/setup`, {
            headers: { Authorization: `Bearer ${token}` },
        }).then(({ data }) => {
            setProfile(data);
        }).catch((requestError) => {
            setError(requestError.response?.data?.error || 'Unable to load your account details.');
        }).finally(() => setLoadingProfile(false));
    }, []);

    const updateProfile = (field, value) => {
        setProfile((current) => ({ ...current, [field]: value }));
    };

    const handleSubmit = async (event) => {
        event.preventDefault();
        setError('');
        if (newPassword.length < 8) {
            setError('Your new password must be at least 8 characters.');
            return;
        }
        if (newPassword !== confirmPassword) {
            setError('Your new password and confirmation do not match.');
            return;
        }

        setSaving(true);
        try {
            const token = localStorage.getItem('token');
            await axios.post(`${API_ORIGIN}/api/account/setup`, {
                full_name: profile.full_name,
                email: profile.email,
                phone: profile.phone,
                current_password: currentPassword,
                new_password: newPassword,
            }, { headers: { Authorization: `Bearer ${token}` } });

            localStorage.removeItem('must_change_password');
            localStorage.setItem('name', profile.full_name.trim());
            localStorage.setItem('email', profile.email.trim());
            navigate(ROLE_HOME[profile.role] || '/login', { replace: true });
        } catch (requestError) {
            setError(requestError.response?.data?.error || 'Unable to save your account setup.');
        } finally {
            setSaving(false);
        }
    };

    const inputClass = 'w-full rounded-xl border bg-white px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-[#6D2140]/15';
    const inputStyle = { borderColor: BORDER, color: INK };
    const passwordFields = [
        ['current-password', 'Temporary password', currentPassword, setCurrentPassword, 'current-password'],
        ['new-password', 'New password', newPassword, setNewPassword, 'new-password'],
        ['confirm-password', 'Confirm new password', confirmPassword, setConfirmPassword, 'new-password'],
    ];

    return (
        <main className="min-h-screen flex items-center justify-center px-4 py-8" style={{ background: BG, color: INK, fontFamily: "'Inter', 'Segoe UI', sans-serif" }}>
            <section className="w-full max-w-3xl overflow-hidden rounded-3xl shadow-xl" style={{ background: SURFACE, border: `1px solid ${BORDER}` }}>
                <header className="px-6 py-7 text-white sm:px-9 sm:py-9" style={{ background: `linear-gradient(135deg, ${PRIMARY_DEEP}, ${PRIMARY})` }}>
                    <p className="mb-2 text-xs font-bold uppercase tracking-[0.2em] text-white/70">Account setup · {ROLE_LABEL[profile.role] || 'Team Portal'}</p>
                    <h1 className="font-serif text-2xl font-bold sm:text-3xl">Complete your account</h1>
                    <p className="mt-2 max-w-xl text-sm leading-6 text-white/80">
                        Confirm your contact details and replace the temporary password before entering your portal.
                    </p>
                    {profile.login_id && <p className="mt-4 inline-flex rounded-full border border-white/25 px-3 py-1 text-xs text-white/90">Login ID: {profile.login_id}</p>}
                </header>

                {loadingProfile ? (
                    <div className="px-6 py-10 text-center text-sm" style={{ color: MUTED }}>Loading your account details…</div>
                ) : (
                    <form onSubmit={handleSubmit} className="grid gap-6 p-6 sm:grid-cols-2 sm:p-9">
                        <section className="space-y-4">
                            <h2 className="flex items-center gap-2 text-sm font-bold" style={{ color: PRIMARY_DEEP }}>
                                <UserRound size={17} /> Contact details
                            </h2>
                            <label className="block text-xs font-semibold" style={{ color: MUTED }}>
                                Full name
                                <input className={`${inputClass} mt-1.5`} style={inputStyle} value={profile.full_name} onChange={(event) => updateProfile('full_name', event.target.value)} autoComplete="name" required maxLength={255} />
                            </label>
                            <label className="block text-xs font-semibold" style={{ color: MUTED }}>
                                Email address
                                <input className={`${inputClass} mt-1.5`} style={inputStyle} type="email" value={profile.email} onChange={(event) => updateProfile('email', event.target.value)} autoComplete="email" required maxLength={255} />
                            </label>
                            <label className="block text-xs font-semibold" style={{ color: MUTED }}>
                                Phone number
                                <input className={`${inputClass} mt-1.5`} style={inputStyle} type="tel" value={profile.phone} onChange={(event) => updateProfile('phone', event.target.value)} autoComplete="tel" required maxLength={64} />
                            </label>
                        </section>

                        <section className="space-y-4">
                            <h2 className="flex items-center gap-2 text-sm font-bold" style={{ color: PRIMARY_DEEP }}>
                                <ShieldCheck size={17} /> Set a new password
                            </h2>
                            <div className="flex gap-2 rounded-xl p-3 text-xs leading-5" style={{ background: '#F3E7EC', color: PRIMARY_DEEP }}>
                                <KeyRound size={16} className="mt-0.5 shrink-0" />
                                Use the temporary password sent by your administrator as your current password.
                            </div>
                            {passwordFields.map(([id, label, value, setValue, autoComplete]) => (
                                <label key={id} className="block text-xs font-semibold" style={{ color: MUTED }}>
                                    {label}
                                    <span className="relative mt-1.5 block">
                                        <input
                                            id={id}
                                            className={inputClass}
                                            style={{ ...inputStyle, paddingRight: 48 }}
                                            type={showPasswords ? 'text' : 'password'}
                                            value={value}
                                            onChange={(event) => setValue(event.target.value)}
                                            autoComplete={autoComplete}
                                            required
                                            minLength={id === 'current-password' ? undefined : 8}
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowPasswords((visible) => !visible)}
                                            aria-label={showPasswords ? 'Hide passwords' : 'Show passwords'}
                                            className="absolute right-3 top-1/2 -translate-y-1/2"
                                            style={{ color: MUTED, background: 'none', border: 0 }}
                                        >
                                            {showPasswords ? <EyeOff size={17} /> : <Eye size={17} />}
                                        </button>
                                    </span>
                                </label>
                            ))}
                        </section>

                        {error && <p role="alert" className="rounded-xl px-4 py-3 text-sm font-medium sm:col-span-2" style={{ background: '#A24A4A12', color: ERROR }}>{error}</p>}

                        <div className="sm:col-span-2">
                            <button
                                type="submit"
                                disabled={saving}
                                className="inline-flex w-full items-center justify-center gap-2 rounded-xl px-5 py-3.5 text-sm font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
                                style={{ background: PRIMARY }}
                            >
                                {saving ? 'Saving account…' : 'Save details and continue'} <ArrowRight size={16} />
                            </button>
                        </div>
                    </form>
                )}
            </section>
        </main>
    );
};

export default AccountSetup;
