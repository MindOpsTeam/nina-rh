import React, { useState } from 'react';
import { Building2, User, Eye, Users as UsersIcon } from 'lucide-react';
import { motion } from 'framer-motion';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface StepIdentityProps {
  companyName: string;
  sdrName: string;
  onCompanyNameChange: (value: string) => void;
  onSdrNameChange: (value: string) => void;
}

type OperatorType = 'rh_interno' | 'agencia_rh' | 'headhunter_freelancer';

const OPERATOR_OPTIONS: { value: OperatorType; label: string; hint: string }[] = [
  {
    value: 'rh_interno',
    label: 'Recrutador interno (RH da própria empresa)',
    hint: 'Time interno conduz processos das vagas da própria empresa',
  },
  {
    value: 'agencia_rh',
    label: 'Agência / consultoria de RH',
    hint: 'Atende múltiplos clientes contratantes',
  },
  {
    value: 'headhunter_freelancer',
    label: 'Headhunter freelancer',
    hint: 'Operação individual de captação de talentos',
  },
];

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.1,
    },
  },
} as const;

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { 
    opacity: 1, 
    y: 0,
    transition: { type: "spring" as const, stiffness: 300, damping: 24 }
  },
};

export const StepIdentity: React.FC<StepIdentityProps> = ({
  companyName,
  sdrName,
  onCompanyNameChange,
  onSdrNameChange,
}) => {
  const [operatorType, setOperatorType] = useState<OperatorType>('rh_interno');
  return (
    <motion.div 
      className="space-y-8"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      <motion.div variants={itemVariants} className="text-center mb-8">
        <motion.div 
          className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-primary/20 to-accent/20 border border-primary/30 flex items-center justify-center"
          whileHover={{ scale: 1.05, rotate: 5 }}
          transition={{ type: "spring", stiffness: 400 }}
        >
          <Building2 className="w-8 h-8 text-primary" />
        </motion.div>
        <h3 className="text-xl font-semibold text-foreground mb-2">Identidade da empresa contratante</h3>
        <p className="text-muted-foreground text-sm max-w-md mx-auto">
          Configure como sua operação de RH e a Nina vão se apresentar aos candidatos.
        </p>
      </motion.div>

      <div className="space-y-6 max-w-md mx-auto">
        <motion.div variants={itemVariants} className="space-y-2">
          <Label htmlFor="companyName" className="flex items-center gap-2">
            <Building2 className="w-4 h-4 text-muted-foreground" />
            Nome da empresa contratante
          </Label>
          <Input
            id="companyName"
            value={companyName}
            onChange={(e) => onCompanyNameChange(e.target.value)}
            placeholder="Ex: Hospital São Lucas, Agência Talentos+, etc"
            className="focus:ring-primary"
          />
          <p className="text-xs text-muted-foreground">Aparecerá no header e nas mensagens da Nina aos candidatos</p>
        </motion.div>

        <motion.div variants={itemVariants} className="space-y-2">
          <Label htmlFor="sdrName" className="flex items-center gap-2">
            <User className="w-4 h-4 text-muted-foreground" />
            Nome da atendente IA (recrutadora)
          </Label>
          <Input
            id="sdrName"
            value={sdrName}
            onChange={(e) => onSdrNameChange(e.target.value)}
            placeholder="Ex: Nina, Júlia, Carla..."
            className="focus:ring-primary"
          />
          <p className="text-xs text-muted-foreground">Nome que a IA usará ao triar candidatos no WhatsApp</p>
        </motion.div>

        <motion.div variants={itemVariants} className="space-y-3">
          <Label className="flex items-center gap-2">
            <UsersIcon className="w-4 h-4 text-muted-foreground" />
            Tipo de operação
          </Label>
          <div className="space-y-2">
            {OPERATOR_OPTIONS.map((opt) => (
              <label
                key={opt.value}
                className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                  operatorType === opt.value
                    ? 'bg-primary/10 border-primary/40'
                    : 'bg-secondary/30 border-border hover:bg-secondary/50'
                }`}
              >
                <input
                  type="radio"
                  name="operatorType"
                  value={opt.value}
                  checked={operatorType === opt.value}
                  onChange={() => setOperatorType(opt.value)}
                  className="mt-1 accent-cyan-500"
                />
                <div className="flex flex-col">
                  <span className="text-sm font-medium text-foreground">
                    {opt.label}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {opt.hint}
                  </span>
                </div>
              </label>
            ))}
          </div>
        </motion.div>
      </div>

      {/* Preview */}
      {(companyName || sdrName) && (
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: "spring", stiffness: 300, damping: 24 }}
          className="mt-8 p-4 rounded-xl bg-secondary/30 border border-border max-w-md mx-auto"
        >
          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-3">
            <Eye className="w-3 h-3" />
            Preview
          </div>
          <div className="space-y-2 text-sm">
            <p className="text-muted-foreground">
              <span className="text-muted-foreground/70">Empresa:</span>{' '}
              <span className="text-foreground font-medium">{companyName || 'Sua Empresa'}</span>
            </p>
            <p className="text-muted-foreground">
              <span className="text-muted-foreground/70">Agente:</span>{' '}
              <span className="text-primary font-medium">{sdrName || 'Agente'}</span>
            </p>
          </div>
        </motion.div>
      )}
    </motion.div>
  );
};
