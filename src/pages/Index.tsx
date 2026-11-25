import { Layout } from "@/components/layout/Layout";
import { BentoHome } from "@/components/home/BentoHome";
import { CheckStatusSection } from "@/components/home/CheckStatusSection";
import { DepartmentWorkLogSection } from "@/components/home/DepartmentWorkLogSection";
import { DepartmentPendingSlider } from "@/components/home/DepartmentPendingSlider";
import { PaymentStatusSlider } from "@/components/home/PaymentStatusSlider";
import { PanchayathFlashBanner } from "@/components/home/PanchayathFlashBanner";
import { PanchayathDetailsTicker } from "@/components/home/PanchayathDetailsTicker";
import { VirtualOfficeHome } from "@/components/home/VirtualOfficeHome";
import { useHomeViewPreference } from "@/hooks/useHomeViewPreference";

const Index = () => {
  const { view } = useHomeViewPreference();

  return (
    <Layout>
      {view === "virtual-office" ? (
        <VirtualOfficeHome />
      ) : (
        <>
          <PanchayathFlashBanner />
          <PanchayathDetailsTicker />
          <BentoHome
            afterHero={
              <>
                <PaymentStatusSlider />
                <DepartmentWorkLogSection />
                <CheckStatusSection />
              </>
            }
          />
          <DepartmentPendingSlider />
        </>
      )}
    </Layout>
  );
};

export default Index;
