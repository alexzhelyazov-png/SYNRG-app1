import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Button, Typography, Box, IconButton,
} from '@mui/material'
import CloseIcon from '@mui/icons-material/Close'
import { C } from '../theme'

const SECTION = ({ title, children }) => (
  <Box sx={{ mb: 2.5 }}>
    <Typography sx={{ fontWeight: 800, fontSize: '14px', color: C.text, mb: 0.75 }}>
      {title}
    </Typography>
    {children}
  </Box>
)

const P = ({ children }) => (
  <Typography sx={{ fontSize: '13px', color: C.muted, lineHeight: 1.65, mb: 0.75 }}>
    {children}
  </Typography>
)

export default function PrivacyPolicyDialog({ open, onClose }) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{ sx: { borderRadius: '20px', maxHeight: '90vh' } }}
    >
      <DialogTitle sx={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        pb: 1, fontWeight: 800, fontSize: '17px',
      }}>
        Политика за поверителност
        <IconButton onClick={onClose} size="small" sx={{ color: C.muted }}>
          <CloseIcon fontSize="small" />
        </IconButton>
      </DialogTitle>

      <DialogContent sx={{ pt: 0.5 }}>
        <Typography sx={{ fontSize: '11px', color: C.muted, mb: 2.5 }}>
          Последна актуализация: Април 2026 г.
        </Typography>

        <SECTION title="1. Администратор на данните">
          <P>
            Администратор на личните ви данни е{' '}
            <strong style={{ color: C.text }}>Синерджи 93 ООД</strong>,
            ЕИК <strong style={{ color: C.text }}>207343690</strong>,
            достъпно на адрес <strong style={{ color: C.text }}>synrg-beyondfitness.com</strong> и на имейл{' '}
            <strong style={{ color: C.text }}>info@synrg-beyondfitness.com</strong>.
          </P>
        </SECTION>

        <SECTION title="2. Какви данни събираме">
          <P>Събираме следните категории лични данни:</P>
          <Box component="ul" sx={{ pl: 2.5, m: 0 }}>
            {[
              'Идентификационни данни — имe и парола (хеширана)',
              'Данни за контакт — имейл адрес (по избор)',
              'Здравни и фитнес данни — хранителен дневник, тегло, стъпки, тренировки',
              'Технически данни — дата и час на влизане в системата',
            ].map(item => (
              <Typography key={item} component="li" sx={{ fontSize: '13px', color: C.muted, lineHeight: 1.65, mb: 0.5 }}>
                {item}
              </Typography>
            ))}
          </Box>
          <P sx={{ mt: 1 }}>
            Здравните и фитнес данни се считат за данни от специална категория по смисъла на
            чл. 9 от GDPR. Те се обработват единствено въз основа на вашето изрично съгласие.
          </P>
        </SECTION>

        <SECTION title="3. Цели на обработването">
          <P>Данните се използват единствено за:</P>
          <Box component="ul" sx={{ pl: 2.5, m: 0 }}>
            {[
              'Управление на вашия акаунт и автентикация',
              'Проследяване на вашия хранителен прием, тегло и тренировки',
              'Комуникация с вашия треньор',
              'Изпращане на напомняния по имейл (само ако сте предоставили имейл)',
              'Обработка на плащания (само при покупка на програма)',
            ].map(item => (
              <Typography key={item} component="li" sx={{ fontSize: '13px', color: C.muted, lineHeight: 1.65, mb: 0.5 }}>
                {item}
              </Typography>
            ))}
          </Box>
        </SECTION>

        <SECTION title="4. Правно основание">
          <P>
            Обработването на обичайни лични данни (име, имейл) се извършва въз основа на{' '}
            <strong style={{ color: C.text }}>договорно отношение</strong> (чл. 6, ал. 1, б. &quot;б&quot; GDPR).
          </P>
          <P>
            Обработването на здравни и фитнес данни се извършва единствено въз основа на вашето{' '}
            <strong style={{ color: C.text }}>изрично съгласие</strong> (чл. 9, ал. 2, б. &quot;а&quot; GDPR),
            дадено при регистрацията. Можете да оттеглите съгласието си по всяко време, като
            изтриете акаунта си.
          </P>
        </SECTION>

        <SECTION title="5. Получатели на данните">
          <P>Данните ви могат да бъдат предадени на следните обработващи лица:</P>
          <Box component="ul" sx={{ pl: 2.5, m: 0 }}>
            {[
              'Supabase Inc. (Supabase.com) — хостинг на базата данни, сървъри в ЕС',
              'Brevo SAS (Brevo.com) — изпращане на имейли, при предоставен имейл',
              'Stripe Inc. (Stripe.com) — обработка на плащания, при покупка на програма',
            ].map(item => (
              <Typography key={item} component="li" sx={{ fontSize: '13px', color: C.muted, lineHeight: 1.65, mb: 0.5 }}>
                {item}
              </Typography>
            ))}
          </Box>
          <P>
            Данните не се предоставят на трети страни за рекламни или маркетингови цели.
          </P>
        </SECTION>

        <SECTION title="6. Срок на съхранение">
          <P>
            Данните ви се съхраняват за срока на съществуване на вашия акаунт. При изтриване на
            акаунта всички данни се унищожават в реално време. Резервни копия се изтриват в
            рамките на 30 дни.
          </P>
        </SECTION>

        <SECTION title="7. Вашите права">
          <P>Съгласно GDPR имате следните права:</P>
          <Box component="ul" sx={{ pl: 2.5, m: 0 }}>
            {[
              'Право на достъп — да поискате копие на данните си',
              'Право на коригиране — да коригирате неточни данни',
              'Право на изтриване — да изтриете акаунта си (достъпно директно от приложението)',
              'Право на преносимост — да получите данните си в машинно-четим формат',
              'Право на оттегляне на съгласие — по всяко време, без да засяга законосъобразността на предходното обработване',
            ].map(item => (
              <Typography key={item} component="li" sx={{ fontSize: '13px', color: C.muted, lineHeight: 1.65, mb: 0.5 }}>
                {item}
              </Typography>
            ))}
          </Box>
          <P>
            За упражняване на правата си се обърнете към нас на{' '}
            <strong style={{ color: C.text }}>info@synrg-beyondfitness.com</strong>.
            Имате право да подадете жалба до Комисия за защита на личните данни (КЗЛД) на адрес{' '}
            <strong style={{ color: C.text }}>www.cpdp.bg</strong>.
          </P>
        </SECTION>

        <SECTION title="8. Бисквитки (Cookies)">
          <P>
            Приложението не използва рекламни бисквитки. Използват се единствено технически
            бисквитки за поддържане на сесията (localStorage), необходими за функционирането на
            приложението.
          </P>
        </SECTION>

        <SECTION title="9. Промени в политиката">
          <P>
            При съществени промени ще бъдете уведомени при следващото влизане в приложението.
            Актуалната версия е винаги достъпна в приложението.
          </P>
        </SECTION>
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 3, pt: 0 }}>
        <Button
          onClick={onClose}
          variant="contained"
          color="primary"
          fullWidth
          sx={{ fontWeight: 800, py: 1.5 }}
        >
          Разбрах
        </Button>
      </DialogActions>
    </Dialog>
  )
}
