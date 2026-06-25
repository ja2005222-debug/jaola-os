import { getDb } from '../services/db.js';
import * as Coder from './coder.agent.js';

/**
 * وكيل المعماري (Architect Agent)
 * تم ترقية التصميم ليكون "قابلاً للتوسع" (Scalable) ومعداً لاستقبال طلبيات متعددة
 * تم إصلاح استدعاء وكيل البرمجة (Coder) ليطابق واجهة التنفيذ الموحدة
 */
export async function run(context) {
    console.log(`[Architect] Designing Scalable Infrastructure for: ${context.projectId}`);
    
    const db = getDb();
    const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(context.projectId);
    
    if (!project) {
        throw new Error("لم يتم العثور على خطة المشروع!");
    }

    // تصميم هيكلية تدعم "الطلبيات المتعددة" والتوسع المستقبلي
    const architecture = {
        framework: 'Python/Django (Modular)',
        version: '2.0-Scalable',
        coreComponents: {
            auth: 'JWT/OAuth2 (Multi-tenant ready)',
            api: 'Django Rest Framework (Versioning supported)',
            database: 'PostgreSQL/MySQL (Normalized)',
            storage: 'Object Storage Abstraction (S3/GCS)'
        },
        // تقسيم المجلدات ليدعم عزل العملاء (Multi-Tenancy)
        structure: {
            shared: ['/common', '/utils', '/services'],
            tenants: ['/apps/client_x', '/apps/client_y'],
            assets: '/cdn/storage/tenants'
        },
        imageProcessing: 'Celery + Pillow (Asynchronous processing for high load)',
        config: { 
            environment: 'production',
            scaling: 'Horizontal (Docker/Kubernetes ready)'
        }
    };

    console.log(`[Architect] Scalable Architecture finalized. Triggering Coder Agent...`);
    
    // حفظ التحديث
    const existingPlan = JSON.parse(project.plan || '{}');
    const updatedPlan = { ...existingPlan, architecture };

    db.prepare(
        'UPDATE projects SET plan = ?, status = ? WHERE id = ?'
    ).run(JSON.stringify(updatedPlan), 'designed_for_scale', context.projectId);
    
    context.architecture = architecture;
    context.status = 'designed';

    // تنفيذ البرمجة الفعلية باستدعاء الدالة run الموحدة في Coder Agent
    await Coder.run(context);
    
    return { status: 'success', architecture };
}
