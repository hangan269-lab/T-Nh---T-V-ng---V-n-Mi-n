import React, { useState } from 'react';
import {
  Building2,
  Calculator,
  ExternalLink,
  Filter,
  MapPin,
  Phone,
  Plus,
  Search,
  Star,
  Trash2,
  Edit2,
  Globe,
  DollarSign,
  CheckCircle2,
  Clock,
  AlertCircle,
  MessageSquare,
} from 'lucide-react';
import { ChinaPartner, UserAccount } from '../types/erp';

interface ChinaPartnersTabProps {
  partners: ChinaPartner[];
  currentUser: UserAccount;
  onAddPartner: (partner: Omit<ChinaPartner, 'id'>) => void;
  onUpdatePartner: (id: string, patch: Partial<ChinaPartner>) => void;
  onDeletePartner: (id: string) => void;
}

export const ChinaPartnersTab: React.FC<ChinaPartnersTabProps> = ({
  partners,
  currentUser,
  onAddPartner,
  onUpdatePartner,
  onDeletePartner,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [regionFilter, setRegionFilter] = useState('all');
  const [channelFilter, setChannelFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPartner, setEditingPartner] = useState<ChinaPartner | null>(null);

  // Form state
  const [name, setName] = useState('');
  const [region, setRegion] = useState('Hàng Châu (Chiết Giang)');
  const [specialty, setSpecialty] = useState('Tơ lụa tự nhiên, vải gấm Jacquard');
  const [contactWeChat, setContactWeChat] = useState('');
  const [phoneOrWhatsApp, setPhoneOrWhatsApp] = useState('');
  const [channel, setChannel] = useState<'Tiểu ngạch' | 'Chính ngạch' | 'Kho trung chuyển' | 'Giao biên giới'>('Chính ngạch');
  const [exchangeRateCNY, setExchangeRateCNY] = useState('3550');
  const [rating, setRating] = useState('5');
  const [status, setStatus] = useState<'Hợp tác thường xuyên' | 'Tiềm năng' | 'Tạm ngưng'>('Hợp tác thường xuyên');
  const [notes, setNotes] = useState('');

  // Calculator state
  const [cnyAmount, setCnyAmount] = useState('1000');
  const [selectedCalcRate, setSelectedCalcRate] = useState(3550);

  const regions = Array.from(new Set(partners.map((p) => p.region)));
  const channels = ['Tiểu ngạch', 'Chính ngạch', 'Kho trung chuyển', 'Giao biên giới'];
  const statuses = ['Hợp tác thường xuyên', 'Tiềm năng', 'Tạm ngưng'];

  const filteredPartners = partners.filter((p) => {
    const matchesSearch =
      p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.specialty.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.region.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.contactWeChat.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesRegion = regionFilter === 'all' || p.region === regionFilter;
    const matchesChannel = channelFilter === 'all' || p.channel === channelFilter;
    const matchesStatus = statusFilter === 'all' || p.status === statusFilter;
    return matchesSearch && matchesRegion && matchesChannel && matchesStatus;
  });

  const avgExchangeRate =
    partners.length > 0
      ? Math.round(partners.reduce((acc, p) => acc + p.exchangeRateCNY, 0) / partners.length)
      : 3550;

  const handleOpenAdd = () => {
    setEditingPartner(null);
    setName('');
    setRegion('Hàng Châu (Chiết Giang)');
    setSpecialty('Tơ lụa tự nhiên & gấm thêu tay');
    setContactWeChat('');
    setPhoneOrWhatsApp('');
    setChannel('Chính ngạch');
    setExchangeRateCNY('3550');
    setRating('5');
    setStatus('Hợp tác thường xuyên');
    setNotes('');
    setIsModalOpen(true);
  };

  const handleOpenEdit = (p: ChinaPartner) => {
    setEditingPartner(p);
    setName(p.name);
    setRegion(p.region);
    setSpecialty(p.specialty);
    setContactWeChat(p.contactWeChat);
    setPhoneOrWhatsApp(p.phoneOrWhatsApp);
    setChannel(p.channel);
    setExchangeRateCNY(String(p.exchangeRateCNY));
    setRating(String(p.rating));
    setStatus(p.status);
    setNotes(p.notes);
    setIsModalOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const payload = {
      name: name.trim(),
      region: region.trim(),
      specialty: specialty.trim(),
      contactWeChat: contactWeChat.trim(),
      phoneOrWhatsApp: phoneOrWhatsApp.trim(),
      channel,
      exchangeRateCNY: Number(exchangeRateCNY) || 3550,
      rating: Number(rating) || 5,
      status,
      notes: notes.trim(),
      lastOrderDate: new Date().toISOString().split('T')[0],
    };

    if (editingPartner) {
      onUpdatePartner(editingPartner.id, payload);
    } else {
      onAddPartner(payload);
    }
    setIsModalOpen(false);
  };

  return (
    <div className="space-y-6 text-sm">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-emerald-900 via-teal-900 to-slate-900 rounded-2xl p-6 md:p-8 text-white shadow-xl relative overflow-hidden">
        <div className="absolute right-0 top-0 translate-x-8 -translate-y-8 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 text-xs font-semibold mb-3 border border-emerald-500/30">
              <Globe className="w-3.5 h-3.5" /> Trang 56 · Đối tác & Thị trường Trung Quốc (TQ)
            </div>
            <h1 className="text-xl md:text-2xl font-bold tracking-tight">Mở rộng Sơ đồ Sức mạnh Thị trường & Chuỗi Cung ứng TQ</h1>
            <p className="text-slate-300 text-sm mt-1 max-w-2xl">
              Quản lý trực tiếp các xưởng dệt lụa tại Hàng Châu, Tô Châu, kho phụ liệu Quảng Châu và trà cụ Phúc Kiến. Theo dõi tỷ giá quy đổi nhân dân tệ (CNY), kênh nhập khẩu chính ngạch/tiểu ngạch và đánh giá năng lực nhà cung cấp.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleOpenAdd}
              className="flex items-center gap-2 px-4 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold rounded-xl text-sm transition shadow-lg shadow-emerald-500/20"
            >
              <Plus className="w-4 h-4" /> Thêm đối tác TQ
            </button>
          </div>
        </div>
      </div>

      {/* Summary Cards & Currency Calculator */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
            <Building2 className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm font-medium text-slate-500">Tổng đối tác TQ</p>
            <p className="text-xl font-bold text-slate-900 mt-0.5">{partners.length} xưởng/kho</p>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center shrink-0">
            <DollarSign className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm font-medium text-slate-500">Tỷ giá CNY trung bình</p>
            <p className="text-xl font-bold text-slate-900 mt-0.5 tabular-nums">{avgExchangeRate.toLocaleString('vi-VN')} đ</p>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-sm md:col-span-2 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-800">
              <Calculator className="w-4 h-4 text-emerald-600" /> Máy tính quy đổi tỷ giá CNY / VND
            </div>
            <span className="text-xs text-slate-500">1 CNY = {selectedCalcRate} VNĐ</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative flex-1">
              <input
                type="number"
                value={cnyAmount}
                onChange={(e) => setCnyAmount(e.target.value)}
                placeholder="Nhập số tệ (CNY)"
                className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-1.5 text-sm font-mono text-slate-900 focus:outline-none focus:border-emerald-500"
              />
              <span className="absolute right-3 top-2 text-xs text-slate-400 font-medium">CNY (¥)</span>
            </div>
            <span className="text-slate-400 font-bold">=</span>
            <div className="flex-1 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-1.5 text-sm font-mono font-bold text-emerald-800 text-right">
              {((Number(cnyAmount) || 0) * selectedCalcRate).toLocaleString('vi-VN')} đ
            </div>
          </div>
        </div>
      </div>

      {/* Filters & Search */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="relative w-full md:w-80">
          <Search className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Tìm theo tên xưởng, đặc sản, WeChat..."
            className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm text-slate-900 focus:outline-none focus:border-emerald-500"
          />
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          <select
            value={regionFilter}
            onChange={(e) => setRegionFilter(e.target.value)}
            className="bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-sm text-slate-700 focus:outline-none focus:border-emerald-500"
          >
            <option value="all">Tất cả khu vực TQ</option>
            {regions.map((r) => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>

          <select
            value={channelFilter}
            onChange={(e) => setChannelFilter(e.target.value)}
            className="bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-sm text-slate-700 focus:outline-none focus:border-emerald-500"
          >
            <option value="all">Tất cả kênh nhập</option>
            {channels.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-sm text-slate-700 focus:outline-none focus:border-emerald-500"
          >
            <option value="all">Tất cả trạng thái</option>
            {statuses.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Partners Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {filteredPartners.map((partner) => (
          <div
            key={partner.id}
            className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-sm hover:shadow-md transition flex flex-col justify-between relative group"
          >
            <div>
              <div className="flex items-start justify-between gap-3 mb-3">
                <div>
                  <span
                    className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold mb-1 ${
                      partner.status === 'Hợp tác thường xuyên'
                        ? 'bg-emerald-100 text-emerald-800'
                        : partner.status === 'Tiềm năng'
                        ? 'bg-blue-100 text-blue-800'
                        : 'bg-amber-100 text-amber-800'
                    }`}
                  >
                    {partner.status}
                  </span>
                  <h3 className="text-base font-bold text-slate-900 group-hover:text-emerald-700 transition">
                    {partner.name}
                  </h3>
                </div>
                <div className="flex items-center gap-1 text-amber-500 bg-amber-50 px-2 py-1 rounded-lg text-xs font-bold">
                  <Star className="w-3.5 h-3.5 fill-current" /> {partner.rating}/5
                </div>
              </div>

              <div className="space-y-2 text-sm text-slate-600 mb-4">
                <div className="flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-slate-400 shrink-0" />
                  <span className="font-medium text-slate-800">{partner.region}</span>
                </div>
                <div className="flex items-start gap-2">
                  <Globe className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                  <span>{partner.specialty}</span>
                </div>
                <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                  <span className="text-xs text-slate-500 font-medium">Kênh: {partner.channel}</span>
                  <span className="text-xs font-mono font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">
                    1¥ = {partner.exchangeRateCNY.toLocaleString('vi-VN')}đ
                  </span>
                </div>
              </div>

              {partner.notes && (
                <p className="text-xs text-slate-500 bg-slate-50 p-2.5 rounded-xl border border-slate-100 mb-4 italic">
                  "{partner.notes}"
                </p>
              )}
            </div>

            <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                {partner.contactWeChat && (
                  <span className="flex items-center gap-1 text-xs text-slate-700 bg-slate-100 px-2 py-1 rounded-lg font-mono">
                    <MessageSquare className="w-3 h-3 text-emerald-600" /> {partner.contactWeChat}
                  </span>
                )}
                {partner.phoneOrWhatsApp && (
                  <span className="flex items-center gap-1 text-xs text-slate-700 bg-slate-100 px-2 py-1 rounded-lg font-mono">
                    <Phone className="w-3 h-3 text-teal-600" /> {partner.phoneOrWhatsApp}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-1">
                <button
                  onClick={() => {
                    setSelectedCalcRate(partner.exchangeRateCNY);
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                  title="Dùng tỷ giá này tính toán"
                  className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition"
                >
                  <Calculator className="w-4 h-4" />
                </button>
                <button
                  onClick={() => handleOpenEdit(partner)}
                  title="Sửa thông tin"
                  className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition"
                >
                  <Edit2 className="w-4 h-4" />
                </button>
                {currentUser.role === 'Admin' && (
                  <button
                    onClick={() => onDeletePartner(partner.id)}
                    title="Xóa đối tác"
                    className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {filteredPartners.length === 0 && (
        <div className="bg-white rounded-2xl p-12 text-center border border-slate-200">
          <Building2 className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h3 className="text-base font-bold text-slate-800">Không tìm thấy đối tác TQ phù hợp</h3>
          <p className="text-sm text-slate-500 mt-1">Hãy thử tìm kiếm với từ khóa khác hoặc thêm đối tác mới.</p>
        </div>
      )}

      {/* Add / Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg font-bold text-slate-900 mb-4">
              {editingPartner ? 'Sửa thông tin Đối tác & Xưởng TQ' : 'Thêm Đối tác & Xưởng TQ mới (Trang 56)'}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Tên xưởng / Nhà cung cấp *</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ví dụ: Xưởng dệt lụa Tô Châu Hằng Phong"
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2 text-sm text-slate-900 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Khu vực / Tỉnh thành TQ</label>
                  <input
                    type="text"
                    value={region}
                    onChange={(e) => setRegion(e.target.value)}
                    placeholder="Ví dụ: Hàng Châu (Chiết Giang)"
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2 text-sm text-slate-900 focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Kênh nhập hàng</label>
                  <select
                    value={channel}
                    onChange={(e: any) => setChannel(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2 text-sm text-slate-900 focus:outline-none focus:border-emerald-500"
                  >
                    {channels.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Sản phẩm / Thế mạnh chuyên môn</label>
                <input
                  type="text"
                  value={specialty}
                  onChange={(e) => setSpecialty(e.target.value)}
                  placeholder="Ví dụ: Tơ lụa tự nhiên, vải gấm Jacquard, hộp quà"
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2 text-sm text-slate-900 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">WeChat ID / Zalo</label>
                  <input
                    type="text"
                    value={contactWeChat}
                    onChange={(e) => setContactWeChat(e.target.value)}
                    placeholder="suzhou_hangfeng_silk"
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2 text-sm text-slate-900 font-mono focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Số điện thoại / WhatsApp</label>
                  <input
                    type="text"
                    value={phoneOrWhatsApp}
                    onChange={(e) => setPhoneOrWhatsApp(e.target.value)}
                    placeholder="+86 512 6828 1111"
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2 text-sm text-slate-900 font-mono focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Tỷ giá CNY (VNĐ)</label>
                  <input
                    type="number"
                    value={exchangeRateCNY}
                    onChange={(e) => setExchangeRateCNY(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2 text-sm text-slate-900 font-mono focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Đánh giá (1-5)</label>
                  <select
                    value={rating}
                    onChange={(e) => setRating(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2 text-sm text-slate-900 focus:outline-none focus:border-emerald-500"
                  >
                    <option value="5">5 sao (Xuất sắc)</option>
                    <option value="4">4 sao (Tốt)</option>
                    <option value="3">3 sao (Khá)</option>
                    <option value="2">2 sao (Trung bình)</option>
                    <option value="1">1 sao (Kém)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Trạng thái hợp tác</label>
                  <select
                    value={status}
                    onChange={(e: any) => setStatus(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2 text-sm text-slate-700 focus:outline-none focus:border-emerald-500"
                  >
                    {statuses.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Ghi chú & Kinh nghiệm giao dịch</label>
                <textarea
                  rows={3}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Ghi chú về chất lượng vải, thời gian sản xuất, phương thức thanh toán..."
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2 text-sm text-slate-900 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl text-sm transition"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-xl text-sm transition shadow-lg shadow-emerald-600/20"
                >
                  {editingPartner ? 'Lưu thay đổi' : 'Thêm đối tác'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
