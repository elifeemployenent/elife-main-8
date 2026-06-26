import { Layout } from "@/components/layout/Layout";
import { BentoHome } from "@/components/home/BentoHome";
import { CheckStatusSection } from "@/components/home/CheckStatusSection";
import { DepartmentWorkLogSection } from "@/components/home/DepartmentWorkLogSection";
import { DepartmentPendingSlider } from "@/components/home/DepartmentPendingSlider";
import { PaymentStatusSlider } from "@/components/home/PaymentStatusSlider";
import { PanchayathFlashBanner } from "@/components/home/PanchayathFlashBanner";
import { PanchayathDetailsTicker } from "@/components/home/PanchayathDetailsTicker";

const Index = () => {
  return (
    <Layout>
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
    </Layout>
  );
};

export default Index;
